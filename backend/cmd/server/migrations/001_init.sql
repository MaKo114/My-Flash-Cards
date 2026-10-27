CREATE TABLE IF NOT EXISTS cards (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    word TEXT NOT NULL CHECK (length(btrim(word)) > 0),
    part_of_speech TEXT NOT NULL CHECK (length(btrim(part_of_speech)) > 0),
    meaning TEXT NOT NULL CHECK (length(btrim(meaning)) > 0),
    needs_review BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cards_word_pos_unique
    ON cards (lower(btrim(word)), lower(btrim(part_of_speech)));
