package httpapi

import (
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

// Auth protects the API with one shared password (APP_PASSWORD).
// Sessions are signed tokens, so the server keeps no session state and changing the password signs everyone out.
type Auth struct {
	password []byte
	secret   []byte
	mu       sync.Mutex
	failures map[string][]time.Time
}

// NewAuth returns nil when no password is set, which leaves the API open (local development and tests).
func NewAuth(password string) *Auth {
	if password == "" {
		return nil
	}
	secret := sha256.Sum256([]byte("my-flash-cards-session:" + password))
	return &Auth{password: []byte(password), secret: secret[:], failures: map[string][]time.Time{}}
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
func (a *Auth) Blocked(ip string, now time.Time) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.prune(now)
	total := 0
	for _, times := range a.failures {
		total += len(times)
	}
	return len(a.failures[ip]) >= failuresPerIP || total >= failuresGlobal
}

// Check compares the password in constant time and records a failure for the address.
func (a *Auth) Check(ip, password string, now time.Time) bool {
	if subtle.ConstantTimeCompare([]byte(password), a.password) == 1 {
		return true
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	a.failures[ip] = append(a.failures[ip], now)
	return false
}

func (a *Auth) prune(now time.Time) {
	for ip, times := range a.failures {
		kept := times[:0]
		for _, at := range times {
			if now.Sub(at) < failureWindow {
				kept = append(kept, at)
			}
		}
		if len(kept) == 0 {
			delete(a.failures, ip)
		} else {
			a.failures[ip] = kept
		}
	}
}
