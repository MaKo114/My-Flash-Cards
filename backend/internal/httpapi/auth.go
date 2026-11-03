package httpapi

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	sessionLength  = 30 * 24 * time.Hour
	failureWindow  = 15 * time.Minute
	failuresPerIP  = 5
	failuresGlobal = 50
)

// FailureLog stores failed sign-ins. Production uses the database so every serverless
// instance sees the same count; tests use MemoryFailures.
type FailureLog interface {
	// Recent counts failures since the given time for one address and in total.
	Recent(ctx context.Context, ip string, since time.Time) (forIP, total int, err error)
	Record(ctx context.Context, ip string, at time.Time) error
}

// Auth protects the API with one shared password (APP_PASSWORD).
// Sessions are signed tokens, so the server keeps no session state and changing the password signs everyone out.
type Auth struct {
	password []byte
	secret   []byte
	failures FailureLog
}

// NewAuth returns nil when no password is set, which leaves the API open (local development and tests).
func NewAuth(password string, failures FailureLog) *Auth {
	if password == "" {
		return nil
	}
	secret := sha256.Sum256([]byte("my-flash-cards-session:" + password))
	return &Auth{password: []byte(password), secret: secret[:], failures: failures}
}

func (a *Auth) sign(expires string) string {
	mac := hmac.New(sha256.New, a.secret)
	mac.Write([]byte(expires))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func (a *Auth) Token(now time.Time) string {
	expires := strconv.FormatInt(now.Add(sessionLength).Unix(), 10)
	return expires + "." + a.sign(expires)
}

func (a *Auth) Valid(token string, now time.Time) bool {
	expires, signature, found := strings.Cut(token, ".")
	if !found {
		return false
	}
	unix, err := strconv.ParseInt(expires, 10, 64)
	if err != nil || now.Unix() >= unix {
		return false
	}
	return hmac.Equal([]byte(signature), []byte(a.sign(expires)))
}

// Blocked limits guessing: a few failures per address, and a global cap in case addresses are rotated.
func (a *Auth) Blocked(ctx context.Context, ip string, now time.Time) (bool, error) {
	forIP, total, err := a.failures.Recent(ctx, ip, now.Add(-failureWindow))
	if err != nil {
		return false, err
	}
	return forIP >= failuresPerIP || total >= failuresGlobal, nil
}

// Check compares the password in constant time and records a failure for the address.
func (a *Auth) Check(ctx context.Context, ip, password string, now time.Time) (bool, error) {
	if subtle.ConstantTimeCompare([]byte(password), a.password) == 1 {
		return true, nil
	}
	return false, a.failures.Record(ctx, ip, now)
}

// MemoryFailures keeps failures in memory; enough for tests and a single long-running server.
type MemoryFailures struct {
	mu    sync.Mutex
	times map[string][]time.Time
}

func NewMemoryFailures() *MemoryFailures {
	return &MemoryFailures{times: map[string][]time.Time{}}
}

func (m *MemoryFailures) Recent(_ context.Context, ip string, since time.Time) (int, int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	forIP, total := 0, 0
	for address, times := range m.times {
		for _, at := range times {
			if at.After(since) {
				total++
				if address == ip {
					forIP++
				}
			}
		}
	}
	return forIP, total, nil
}

func (m *MemoryFailures) Record(_ context.Context, ip string, at time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.times[ip] = append(m.times[ip], at)
	return nil
}
