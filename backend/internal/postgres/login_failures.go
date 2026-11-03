package postgres

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// LoginFailures records failed sign-ins in the database (implements httpapi.FailureLog).
type LoginFailures struct{ db *pgxpool.Pool }

func NewLoginFailures(db *pgxpool.Pool) *LoginFailures { return &LoginFailures{db: db} }

func (l *LoginFailures) Recent(ctx context.Context, ip string, since time.Time) (int, int, error) {
	var forIP, total int
	err := l.db.QueryRow(ctx,
		"SELECT count(*) FILTER (WHERE ip = $1), count(*) FROM login_failures WHERE failed_at > $2",
		ip, since).Scan(&forIP, &total)
	return forIP, total, err
}

// Record stores a failure and drops entries older than a day so the table stays small.
func (l *LoginFailures) Record(ctx context.Context, ip string, at time.Time) error {
	if _, err := l.db.Exec(ctx, "DELETE FROM login_failures WHERE failed_at < $1", at.Add(-24*time.Hour)); err != nil {
		return err
	}
	_, err := l.db.Exec(ctx, "INSERT INTO login_failures (ip, failed_at) VALUES ($1, $2)", ip, at)
	return err
}
