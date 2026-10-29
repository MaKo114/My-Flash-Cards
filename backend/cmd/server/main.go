package main

import (
	"context"
	"embed"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v3"
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
	if err := pool.Ping(ctx); err != nil {
		log.Fatal(err)
	}
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
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(93276451)"); err != nil {
		return err
	}
	for _, file := range files {
		migration, err := migrations.ReadFile("migrations/" + file.Name())
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, string(migration)); err != nil {
			return fmt.Errorf("migration %s: %w", file.Name(), err)
		}
	}
	return tx.Commit(ctx)
}
