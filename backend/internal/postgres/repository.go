package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"my-flash-cards/backend/internal/domain"
)

const columns = "id, word, part_of_speech, meaning, parts_of_speech, meanings, hint, example, needs_review, srs_step, to_char(due_on, 'YYYY-MM-DD'), correct_count, wrong_count"

type Repository struct{ db *pgxpool.Pool }

func New(db *pgxpool.Pool) *Repository { return &Repository{db: db} }

func scan(row pgx.Row) (domain.Card, error) {
	var card domain.Card
	err := row.Scan(&card.ID, &card.Word, &card.PartOfSpeech, &card.Meaning, &card.PartsOfSpeech, &card.Meanings, &card.Hint, &card.Example, &card.NeedsReview, &card.SRSStep, &card.DueOn, &card.CorrectCount, &card.WrongCount)
	return card, translate(err)
}

func translate(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrNotFound
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return domain.ErrDuplicate
	}
	return err
}

func (r *Repository) List(ctx context.Context) ([]domain.Card, error) {
	rows, err := r.db.Query(ctx, "SELECT "+columns+" FROM cards ORDER BY lower(word), id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	cards := []domain.Card{}
	for rows.Next() {
		card, err := scan(rows)
		if err != nil {
			return nil, err
		}
		cards = append(cards, card)
	}
	return cards, rows.Err()
}

func (r *Repository) Create(ctx context.Context, fields domain.Fields) (domain.Card, error) {
	return scan(r.db.QueryRow(ctx,
		"INSERT INTO cards (word, part_of_speech, meaning, parts_of_speech, meanings, hint, example) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING "+columns,
		fields.Word, fields.PartOfSpeech, fields.Meaning, fields.PartsOfSpeech, fields.Meanings, fields.Hint, fields.Example))
}

func (r *Repository) Update(ctx context.Context, id int64, fields domain.Fields) (domain.Card, error) {
	return scan(r.db.QueryRow(ctx,
		"UPDATE cards SET word=$2, part_of_speech=$3, meaning=$4, parts_of_speech=$5, meanings=$6, hint=$7, example=$8, updated_at=now() WHERE id=$1 RETURNING "+columns,
		id, fields.Word, fields.PartOfSpeech, fields.Meaning, fields.PartsOfSpeech, fields.Meanings, fields.Hint, fields.Example))
}

func (r *Repository) ApplyImport(ctx context.Context, writes []domain.ImportWrite) error {
	if len(writes) == 0 {
		return nil
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var batch pgx.Batch
	for _, write := range writes {
		f := write.Fields
		if write.ID == 0 {
			batch.Queue("INSERT INTO cards (word, part_of_speech, meaning, parts_of_speech, meanings, hint, example) VALUES ($1,$2,$3,$4,$5,$6,$7)",
				f.Word, f.PartOfSpeech, f.Meaning, f.PartsOfSpeech, f.Meanings, f.Hint, f.Example)
		} else {
			batch.Queue("UPDATE cards SET word=$2, part_of_speech=$3, meaning=$4, parts_of_speech=$5, meanings=$6, hint=$7, example=$8, updated_at=now() WHERE id=$1",
				write.ID, f.Word, f.PartOfSpeech, f.Meaning, f.PartsOfSpeech, f.Meanings, f.Hint, f.Example)
		}
	}
	results := tx.SendBatch(ctx, &batch)
	for range writes {
		tag, err := results.Exec()
		if err != nil {
			_ = results.Close()
			return translate(err)
		}
		if tag.RowsAffected() != 1 {
			_ = results.Close()
			return domain.ErrNotFound
		}
	}
	if err := results.Close(); err != nil {
		return translate(err)
	}
	return translate(tx.Commit(ctx))
}

func (r *Repository) SetReview(ctx context.Context, id int64, value bool) (domain.Card, error) {
	return scan(r.db.QueryRow(ctx,
		"UPDATE cards SET needs_review=$2, updated_at=now() WHERE id=$1 RETURNING "+columns, id, value))
}

func (r *Repository) Delete(ctx context.Context, id int64) error {
	tag, err := r.db.Exec(ctx, "DELETE FROM cards WHERE id=$1", id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// RecordAnswer schedules the next review, updates the star and answer counts, and logs the answer for statistics.
func (r *Repository) RecordAnswer(ctx context.Context, id int64, correct bool, today time.Time) (domain.Card, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return domain.Card{}, err
	}
	defer tx.Rollback(ctx)
	var step int
	if err := tx.QueryRow(ctx, "SELECT srs_step FROM cards WHERE id=$1 FOR UPDATE", id).Scan(&step); err != nil {
		return domain.Card{}, translate(err)
	}
	step, due := domain.NextReview(step, correct, today)
	card, err := scan(tx.QueryRow(ctx,
		`UPDATE cards SET srs_step=$2, due_on=$3, needs_review=NOT $4,
			correct_count = correct_count + CASE WHEN $4 THEN 1 ELSE 0 END,
			wrong_count = wrong_count + CASE WHEN $4 THEN 0 ELSE 1 END,
			updated_at=now()
		WHERE id=$1 RETURNING `+columns, id, step, due, correct))
	if err != nil {
		return domain.Card{}, err
	}
	if _, err := tx.Exec(ctx, "INSERT INTO study_log (card_id, correct, studied_on) VALUES ($1,$2,$3)", id, correct, today); err != nil {
		return domain.Card{}, err
	}
	return card, translate(tx.Commit(ctx))
}

func (r *Repository) StudyDays(ctx context.Context) ([]domain.StudyDay, error) {
	rows, err := r.db.Query(ctx, `SELECT to_char(studied_on, 'YYYY-MM-DD'), count(*), count(*) FILTER (WHERE correct)
		FROM study_log GROUP BY studied_on ORDER BY studied_on DESC LIMIT 400`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	days := []domain.StudyDay{}
	for rows.Next() {
		var day domain.StudyDay
		if err := rows.Scan(&day.Date, &day.Answers, &day.Correct); err != nil {
			return nil, err
		}
		days = append(days, day)
	}
	return days, rows.Err()
}
