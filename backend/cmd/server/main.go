package main

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"my-flash-cards/backend/internal/application"
	"my-flash-cards/backend/internal/httpapi"
	"my-flash-cards/backend/internal/postgres"
)

//go:embed migrations/*.sql
var migrations embed.FS

func main() {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		url = "postgres://flashcards:flashcards@localhost:5432/flashcards?sslmode=disable"
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()
	if err := runMigrations(ctx, pool); err != nil {
		log.Fatal(err)
	}
	app := fiber.New(fiber.Config{BodyLimit: 6 << 20})
	httpapi.New(application.New(postgres.New(pool))).Register(app)
	addr := os.Getenv("LISTEN_ADDR")
	if port := os.Getenv("PORT"); port != "" {
		addr = ":" + port
	} else if addr == "" {
		addr = "127.0.0.1:3001"
	}
	log.Fatal(app.Listen(addr))
}

func runMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	files, err := migrations.ReadDir("migrations")
	if err != nil {
		return err
	}
	names := make([]string, 0, len(files))
	for _, file := range files {
		if !file.IsDir() {
			names = append(names, file.Name())
		}
	}
	var appliedCount int
	err = pool.QueryRow(ctx, "SELECT count(*) FROM schema_migrations WHERE name = ANY($1)", names).Scan(&appliedCount)
	if err == nil && appliedCount == len(names) {
		return nil
	}
	var pgErr *pgconn.PgError
	if err != nil && (!errors.As(err, &pgErr) || pgErr.Code != "42P01") {
		return err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(93276451)"); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())"); err != nil {
		return err
	}
	for _, file := range files {
		if file.IsDir() {
			continue
		}
		var applied bool
		if err := tx.QueryRow(ctx, "SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE name=$1)", file.Name()).Scan(&applied); err != nil {
			return err
		}
		if applied {
			continue
		}
		migration, err := migrations.ReadFile("migrations/" + file.Name())
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, string(migration)); err != nil {
			return fmt.Errorf("migration %s: %w", file.Name(), err)
		}
		if _, err := tx.Exec(ctx, "INSERT INTO schema_migrations (name) VALUES ($1)", file.Name()); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
