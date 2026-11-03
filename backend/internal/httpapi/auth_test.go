package httpapi

import (
	"context"
	"encoding/json"
	"io"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"
	"my-flash-cards/backend/internal/application"
	"my-flash-cards/backend/internal/domain"
)

type emptyRepo struct{}

func (emptyRepo) List(context.Context) ([]domain.Card, error) { return []domain.Card{}, nil }
func (emptyRepo) Create(context.Context, domain.Fields) (domain.Card, error) {
	return domain.Card{}, nil
}
func (emptyRepo) Update(context.Context, int64, domain.Fields) (domain.Card, error) {
	return domain.Card{}, nil
}
func (emptyRepo) ApplyImport(context.Context, []domain.ImportWrite) error { return nil }
func (emptyRepo) SetReview(context.Context, int64, bool) (domain.Card, error) {
	return domain.Card{}, nil
}
func (emptyRepo) Delete(context.Context, int64) error { return nil }
func (emptyRepo) RecordAnswer(context.Context, int64, bool, time.Time) (domain.Card, error) {
	return domain.Card{}, nil
}
func (emptyRepo) StudyDays(context.Context) ([]domain.StudyDay, error) {
	return []domain.StudyDay{}, nil
}

func testApp(auth *Auth) *fiber.App {
	app := fiber.New()
	New(application.New(emptyRepo{}), auth).Register(app)
	return app
}

func call(t *testing.T, app *fiber.App, method, path, body, token, ip string) (int, map[string]any) {
	t.Helper()
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	if ip != "" {
		request.Header.Set("X-Forwarded-For", ip)
	}
	response, err := app.Test(request)
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := io.ReadAll(response.Body)
	var parsed map[string]any
	_ = json.Unmarshal(raw, &parsed)
	return response.StatusCode, parsed
}

func TestNoPasswordLeavesAPIOpen(t *testing.T) {
	app := testApp(NewAuth(""))
	if status, _ := call(t, app, "GET", "/api/cards", "", "", ""); status != 200 {
		t.Fatalf("expected open API, got %d", status)
	}
	if _, body := call(t, app, "GET", "/api/session", "", "", ""); body["authRequired"] != false || body["authenticated"] != true {
		t.Fatalf("unexpected session: %v", body)
	}
}

func TestPasswordProtectsAPI(t *testing.T) {
	app := testApp(NewAuth("correct horse"))
	if status, _ := call(t, app, "GET", "/api/health", "", "", ""); status != 200 {
		t.Fatalf("health must stay public, got %d", status)
	}
	if status, _ := call(t, app, "GET", "/api/cards", "", "", ""); status != 401 {
		t.Fatalf("expected 401 without a token, got %d", status)
	}
	if status, _ := call(t, app, "GET", "/api/cards", "", "forged.token", ""); status != 401 {
		t.Fatalf("expected 401 for a forged token, got %d", status)
	}
	if status, _ := call(t, app, "POST", "/api/login", `{"password":"wrong"}`, "", "10.0.0.1"); status != 401 {
		t.Fatalf("expected 401 for a wrong password, got %d", status)
	}
	status, body := call(t, app, "POST", "/api/login", `{"password":"correct horse"}`, "", "10.0.0.1")
	token, _ := body["token"].(string)
	if status != 200 || token == "" {
		t.Fatalf("expected a token, got %d %v", status, body)
	}
	if status, _ := call(t, app, "GET", "/api/cards", "", token, ""); status != 200 {
		t.Fatalf("expected access with a token, got %d", status)
	}
	if _, body := call(t, app, "GET", "/api/session", "", token, ""); body["authRequired"] != true || body["authenticated"] != true {
		t.Fatalf("unexpected session: %v", body)
	}
	if NewAuth("another password").Valid(token, time.Now()) {
		t.Fatal("changing the password must invalidate old sessions")
	}
}

func TestTokensExpire(t *testing.T) {
	auth := NewAuth("secret")
	now := time.Now()
	token := auth.Token(now)
	if !auth.Valid(token, now.Add(29*24*time.Hour)) || auth.Valid(token, now.Add(31*24*time.Hour)) {
		t.Fatal("tokens should last 30 days")
	}
}

func TestLoginIsRateLimited(t *testing.T) {
	app := testApp(NewAuth("secret"))
	for attempt := 0; attempt < failuresPerIP; attempt++ {
		call(t, app, "POST", "/api/login", `{"password":"guess"}`, "", "10.0.0.2")
	}
	if status, _ := call(t, app, "POST", "/api/login", `{"password":"secret"}`, "", "10.0.0.2"); status != 429 {
		t.Fatalf("expected 429 after repeated failures, got %d", status)
	}
	if status, _ := call(t, app, "POST", "/api/login", `{"password":"secret"}`, "", "10.0.0.3"); status != 200 {
		t.Fatalf("another address should still log in, got %d", status)
	}
}
