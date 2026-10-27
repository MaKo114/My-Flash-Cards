package main

import (
	"context"
	"embed"
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
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		log.Fatal(err)
	}
	migration, err := migrations.ReadFile("migrations/001_init.sql")
	if err != nil {
		log.Fatal(err)
	}
	if _, err := pool.Exec(ctx, string(migration)); err != nil {
		log.Fatal(err)
	}
	app := fiber.New(fiber.Config{BodyLimit: 6 << 20})
	httpapi.New(application.New(postgres.New(pool))).Register(app)
	addr := os.Getenv("LISTEN_ADDR")
	if addr == "" {
		addr = "127.0.0.1:3001"
	}
	log.Fatal(app.Listen(addr))
}
