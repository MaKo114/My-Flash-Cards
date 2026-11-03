package domain

import (
	"testing"
	"time"
)

func TestFieldsClean(t *testing.T) {
	clean, err := (Fields{Word: "  run  ", PartOfSpeech: " verb ", Meaning: " วิ่ง ", Hint: " ใช้ขา "}).Clean()
	if err != nil || clean.Word != "Run" || clean.PartOfSpeech != "verb" || clean.Meaning != "วิ่ง" || clean.Hint != "ใช้ขา" {
		t.Fatalf("unexpected result: %#v, %v", clean, err)
	}
	mixed, err := (Fields{Word: "iPhone", PartOfSpeech: "noun", Meaning: "โทรศัพท์"}).Clean()
	if err != nil || mixed.Word != "IPhone" {
		t.Fatalf("expected only the first letter to be capitalized: %#v, %v", mixed, err)
	}
	if _, err := (Fields{Word: "run", PartOfSpeech: " ", Meaning: "วิ่ง"}).Clean(); err != ErrInvalid {
		t.Fatalf("expected ErrInvalid, got %v", err)
	}
	multiple, err := (Fields{Word: " about ", PartsOfSpeech: []string{" verb ", "preposition", "VERB"}, Meanings: []string{" ประมาณ ", "รอบๆ", "เกี่ยวกับ"}}).Clean()
	if err != nil || multiple.Word != "About" || len(multiple.PartsOfSpeech) != 2 || len(multiple.Meanings) != 3 {
		t.Fatalf("unexpected multiple values: %#v, %v", multiple, err)
	}
	if _, err := (Fields{Word: "run", PartsOfSpeech: []string{"verb", " "}, Meanings: []string{"วิ่ง"}}).Clean(); err != ErrInvalid {
		t.Fatalf("expected ErrInvalid for an empty list item, got %v", err)
	}
}

func TestNextReview(t *testing.T) {
	today := time.Date(2026, 11, 3, 0, 0, 0, 0, time.UTC)
	expected := []string{"2026-11-04", "2026-11-06", "2026-11-10", "2026-11-17", "2026-12-03", "2027-01-02", "2027-01-02"}
	step := 0
	for index, want := range expected {
		var due time.Time
		step, due = NextReview(step, true, today)
		if got := due.Format(DayLayout); got != want {
			t.Fatalf("answer %d: due %s, want %s", index+1, got, want)
		}
	}
	if step != len(ReviewIntervals) {
		t.Fatalf("step should stop at the longest interval, got %d", step)
	}
	step, due := NextReview(step, false, today)
	if step != 0 || !due.Equal(today) {
		t.Fatalf("a wrong answer should restart and stay due today: %d %s", step, due)
	}
}

func TestParseDay(t *testing.T) {
	now := time.Date(2026, 11, 3, 23, 30, 0, 0, time.FixedZone("x", -5*3600))
	if day, err := ParseDay("", now); err != nil || day.Format(DayLayout) != "2026-11-04" {
		t.Fatalf("empty day should use the UTC date: %s %v", day, err)
	}
	if day, err := ParseDay("2026-11-03", now); err != nil || day.Format(DayLayout) != "2026-11-03" {
		t.Fatalf("unexpected day: %s %v", day, err)
	}
	if _, err := ParseDay("03/11/2026", now); err != ErrInvalid {
		t.Fatalf("expected ErrInvalid, got %v", err)
	}
}
