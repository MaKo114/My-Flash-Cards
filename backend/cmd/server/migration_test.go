package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"my-flash-cards/backend/internal/domain"
	"my-flash-cards/backend/internal/postgres"
)

func TestGroupLegacyCardsMigration(t *testing.T) {
	url := os.Getenv("MIGRATION_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("MIGRATION_TEST_DATABASE_URL is not set")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	admin, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("migration_test_%d", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer func() {
		cleanup, done := context.WithTimeout(context.Background(), 10*time.Second)
		defer done()
		_, _ = admin.Exec(cleanup, "DROP SCHEMA "+schema+" CASCADE")
	}()
	config, err := pgxpool.ParseConfig(url)
	if err != nil {
		t.Fatal(err)
	}
	config.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	for _, filename := range []string{"001_init.sql", "002_hint.sql"} {
		content, err := migrations.ReadFile("migrations/" + filename)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, string(content)); err != nil {
			t.Fatal(err)
		}
	}
	for _, row := range []struct {
		word, part, meaning, hint string
		review                    bool
	}{
		{"Run", "verb", "วิ่ง", "ใช้ขา", false},
		{"run", "noun", "การวิ่ง", "การเคลื่อนที่", true},
		{"About", "verb, preposition", "ประมาณ, รอบๆ, เกี่ยวกับ", "", false},
	} {
		if _, err := pool.Exec(ctx, "INSERT INTO cards (word, part_of_speech, meaning, hint, needs_review) VALUES ($1,$2,$3,$4,$5)", row.word, row.part, row.meaning, row.hint, row.review); err != nil {
			t.Fatal(err)
		}
	}
	if err := runMigrations(ctx, pool); err != nil {
		t.Fatal(err)
	}
	repo := postgres.New(pool)
	cards, err := repo.List(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(cards) != 2 || len(cards[1].PartsOfSpeech) != 2 || len(cards[1].Meanings) != 2 || !cards[1].NeedsReview || cards[1].Hint == "" {
		t.Fatalf("legacy cards were not preserved and grouped: %#v", cards)
	}
	if len(cards[0].PartsOfSpeech) != 2 || len(cards[0].Meanings) != 3 {
		t.Fatalf("legacy comma-separated values were not preserved: %#v", cards[0])
	}
	if err := repo.ApplyImport(ctx, []domain.ImportWrite{
		{Fields: domain.Fields{Word: "Fresh", PartOfSpeech: "noun", Meaning: "new", PartsOfSpeech: []string{"noun"}, Meanings: []string{"new"}}},
		{Fields: domain.Fields{Word: "Run", PartOfSpeech: "noun", Meaning: "duplicate", PartsOfSpeech: []string{"noun"}, Meanings: []string{"duplicate"}}},
	}); !errors.Is(err, domain.ErrDuplicate) {
		t.Fatalf("expected duplicate to roll back import, got %v", err)
	}
	cards, err = repo.List(ctx)
	if err != nil || len(cards) != 2 {
		t.Fatalf("failed import committed partial rows: %#v, %v", cards, err)
	}
	if _, err := repo.Create(ctx, domain.Fields{Word: "run", PartOfSpeech: "adverb", Meaning: "อย่างรวดเร็ว", PartsOfSpeech: []string{"adverb"}, Meanings: []string{"อย่างรวดเร็ว"}}); !errors.Is(err, domain.ErrDuplicate) {
		t.Fatalf("expected one card per word, got %v", err)
	}
	if err := runMigrations(ctx, pool); err != nil {
		t.Fatalf("migration must be repeatable: %v", err)
	}
	files, err := migrations.ReadDir("migrations")
	if err != nil {
		t.Fatal(err)
	}
	var appliedCount int
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM schema_migrations").Scan(&appliedCount); err != nil || appliedCount != len(files) {
		t.Fatalf("expected %d recorded migrations, got %d, %v", len(files), appliedCount, err)
	}
	today := time.Date(2026, 11, 3, 0, 0, 0, 0, time.UTC)
	answered, err := repo.RecordAnswer(ctx, cards[0].ID, true, today)
	if err != nil || answered.SRSStep != 1 || answered.DueOn == nil || *answered.DueOn != "2026-11-04" || answered.CorrectCount != 1 || answered.NeedsReview {
		t.Fatalf("correct answer was not scheduled: %#v, %v", answered, err)
	}
	answered, err = repo.RecordAnswer(ctx, cards[0].ID, false, today)
	if err != nil || answered.SRSStep != 0 || *answered.DueOn != "2026-11-03" || answered.WrongCount != 1 || !answered.NeedsReview {
		t.Fatalf("wrong answer did not restart the schedule: %#v, %v", answered, err)
	}
	if answered.FirstStudiedOn == nil || *answered.FirstStudiedOn != "2026-11-03" {
		t.Fatalf("first answer day was not kept: %#v", answered)
	}
	later, err := repo.RecordAnswer(ctx, cards[0].ID, true, today.AddDate(0, 0, 2))
	if err != nil || *later.FirstStudiedOn != "2026-11-03" {
		t.Fatalf("later answers must not move the first study day: %#v, %v", later, err)
	}
	failures := postgres.NewLoginFailures(pool)
	now := time.Now()
	for _, ip := range []string{"10.0.0.1", "10.0.0.1", "10.0.0.2"} {
		if err := failures.Record(ctx, ip, now); err != nil {
			t.Fatal(err)
		}
	}
	if forIP, total, err := failures.Recent(ctx, "10.0.0.1", now.Add(-time.Minute)); err != nil || forIP != 2 || total != 3 {
		t.Fatalf("unexpected failure counts: %d %d %v", forIP, total, err)
	}
	if _, err := repo.RecordAnswer(ctx, 999999, true, today); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("expected ErrNotFound for a missing card, got %v", err)
	}
	days, err := repo.StudyDays(ctx)
	if err != nil || len(days) != 2 || days[1] != (domain.StudyDay{Date: "2026-11-03", Answers: 2, Correct: 1}) {
		t.Fatalf("unexpected study days: %#v, %v", days, err)
	}
	if err := repo.Delete(ctx, cards[1].ID); err != nil {
		t.Fatal(err)
	}
	if err := runMigrations(ctx, pool); err != nil {
		t.Fatal(err)
	}
	cards, err = repo.List(ctx)
	if err != nil || len(cards) != 1 || cards[0].Word != "About" {
		t.Fatalf("deleted card returned after restart: %#v, %v", cards, err)
	}
}
