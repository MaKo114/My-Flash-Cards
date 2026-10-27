package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"my-flash-cards/backend/internal/domain"
)

const columns = "id, word, part_of_speech, meaning, needs_review"

type Repository struct{ db *pgxpool.Pool }

func New(db *pgxpool.Pool) *Repository { return &Repository{db: db} }

func scan(row pgx.Row) (domain.Card, error) {
	var card domain.Card
	err := row.Scan(&card.ID, &card.Word, &card.PartOfSpeech, &card.Meaning, &card.NeedsReview)
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
	rows, err := r.db.Query(ctx, "SELECT "+columns+" FROM cards ORDER BY lower(word), lower(part_of_speech), id")
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
		"INSERT INTO cards (word, part_of_speech, meaning) VALUES ($1,$2,$3) RETURNING "+columns,
		fields.Word, fields.PartOfSpeech, fields.Meaning))
}

func (r *Repository) Update(ctx context.Context, id int64, fields domain.Fields) (domain.Card, error) {
	return scan(r.db.QueryRow(ctx,
		"UPDATE cards SET word=$2, part_of_speech=$3, meaning=$4, updated_at=now() WHERE id=$1 RETURNING "+columns,
		id, fields.Word, fields.PartOfSpeech, fields.Meaning))
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
