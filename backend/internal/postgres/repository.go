package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"my-flash-cards/backend/internal/domain"
)

const columns = "id, word, part_of_speech, meaning, parts_of_speech, meanings, hint, needs_review"

type Repository struct{ db *pgxpool.Pool }

func New(db *pgxpool.Pool) *Repository { return &Repository{db: db} }

func scan(row pgx.Row) (domain.Card, error) {
	var card domain.Card
	err := row.Scan(&card.ID, &card.Word, &card.PartOfSpeech, &card.Meaning, &card.PartsOfSpeech, &card.Meanings, &card.Hint, &card.NeedsReview)
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
		"INSERT INTO cards (word, part_of_speech, meaning, parts_of_speech, meanings, hint) VALUES ($1,$2,$3,$4,$5,$6) RETURNING "+columns,
		fields.Word, fields.PartOfSpeech, fields.Meaning, fields.PartsOfSpeech, fields.Meanings, fields.Hint))
}

func (r *Repository) Update(ctx context.Context, id int64, fields domain.Fields) (domain.Card, error) {
	return scan(r.db.QueryRow(ctx,
		"UPDATE cards SET word=$2, part_of_speech=$3, meaning=$4, parts_of_speech=$5, meanings=$6, hint=$7, updated_at=now() WHERE id=$1 RETURNING "+columns,
		id, fields.Word, fields.PartOfSpeech, fields.Meaning, fields.PartsOfSpeech, fields.Meanings, fields.Hint))
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
			batch.Queue("INSERT INTO cards (word, part_of_speech, meaning, parts_of_speech, meanings, hint) VALUES ($1,$2,$3,$4,$5,$6)",
				f.Word, f.PartOfSpeech, f.Meaning, f.PartsOfSpeech, f.Meanings, f.Hint)
		} else {
			batch.Queue("UPDATE cards SET word=$2, part_of_speech=$3, meaning=$4, parts_of_speech=$5, meanings=$6, hint=$7, updated_at=now() WHERE id=$1",
				write.ID, f.Word, f.PartOfSpeech, f.Meaning, f.PartsOfSpeech, f.Meanings, f.Hint)
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
