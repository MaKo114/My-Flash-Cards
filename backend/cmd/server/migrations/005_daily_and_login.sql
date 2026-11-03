-- The day a card was first answered, so the app can limit how many new words start each day.
ALTER TABLE cards ADD COLUMN IF NOT EXISTS first_studied_on DATE;

UPDATE cards
SET first_studied_on = first_answers.first_day
FROM (
    SELECT card_id, min(studied_on) AS first_day
    FROM study_log
    WHERE card_id IS NOT NULL
    GROUP BY card_id
) AS first_answers
WHERE cards.id = first_answers.card_id AND cards.first_studied_on IS NULL;

-- Failed sign-ins live in the database so the limit holds across serverless instances.
CREATE TABLE IF NOT EXISTS login_failures (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ip TEXT NOT NULL,
    failed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_failures_failed_at ON login_failures (failed_at);
