ALTER TABLE cards ADD COLUMN IF NOT EXISTS parts_of_speech TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE cards ADD COLUMN IF NOT EXISTS meanings TEXT[] NOT NULL DEFAULT '{}';

DO $$
DECLARE item RECORD;
BEGIN
    FOR item IN
        SELECT lower(btrim(word)) AS word_key,
               min(id) AS keep_id,
               array_agg(DISTINCT part_of_speech ORDER BY part_of_speech) AS parts,
               array_agg(DISTINCT meaning ORDER BY meaning) AS meanings,
               coalesce(string_agg(DISTINCT nullif(hint, ''), ' · '), '') AS hints,
               bool_or(needs_review) AS review
        FROM cards
        GROUP BY lower(btrim(word))
        HAVING count(*) > 1
    LOOP
        DELETE FROM cards WHERE lower(btrim(word)) = item.word_key AND id <> item.keep_id;
        UPDATE cards
        SET parts_of_speech = item.parts,
            meanings = item.meanings,
            part_of_speech = array_to_string(item.parts, ', '),
            meaning = array_to_string(item.meanings, ', '),
            hint = item.hints,
            needs_review = item.review,
            updated_at = now()
        WHERE id = item.keep_id;
    END LOOP;
END $$;

UPDATE cards SET parts_of_speech = regexp_split_to_array(part_of_speech, '[[:space:]]*,[[:space:]]*') WHERE cardinality(parts_of_speech) = 0;
UPDATE cards SET meanings = regexp_split_to_array(meaning, '[[:space:]]*,[[:space:]]*') WHERE cardinality(meanings) = 0;

CREATE UNIQUE INDEX IF NOT EXISTS cards_word_unique ON cards (lower(btrim(word)));
