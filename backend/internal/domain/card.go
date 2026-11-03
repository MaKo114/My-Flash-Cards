package domain

import (
	"errors"
	"strings"
	"time"
	"unicode"
)

var (
	ErrInvalid   = errors.New("กรุณากรอกคำศัพท์ ชนิดของคำ และความหมาย")
	ErrDuplicate = errors.New("คำศัพท์นี้มีอยู่แล้ว กรุณาแก้ไขบัตรเดิมเพื่อเพิ่มชนิดหรือความหมาย")
	ErrNotFound  = errors.New("ไม่พบคำศัพท์")
)

type Card struct {
	ID            int64    `json:"id"`
	Word          string   `json:"word"`
	PartOfSpeech  string   `json:"partOfSpeech"`
	Meaning       string   `json:"meaning"`
	PartsOfSpeech []string `json:"partsOfSpeech"`
	Meanings      []string `json:"meanings"`
	Hint          string   `json:"hint"`
	Example       string   `json:"example"`
	NeedsReview   bool     `json:"needsReview"`
	// SRSStep counts correct answers in a row; DueOn is the day the card should be reviewed (nil until first answered).
	SRSStep      int     `json:"srsStep"`
	DueOn        *string `json:"dueOn"`
	CorrectCount int     `json:"correctCount"`
	WrongCount   int     `json:"wrongCount"`
}

type Fields struct {
	Word          string   `json:"word"`
	PartOfSpeech  string   `json:"partOfSpeech"`
	Meaning       string   `json:"meaning"`
	PartsOfSpeech []string `json:"partsOfSpeech"`
	Meanings      []string `json:"meanings"`
	Hint          string   `json:"hint"`
	Example       string   `json:"example"`
}

type ImportWrite struct {
	ID     int64
	Fields Fields
}

func (f Fields) Clean() (Fields, error) {
	f.Word = strings.TrimSpace(f.Word)
	f.Hint = strings.TrimSpace(f.Hint)
	f.Example = strings.TrimSpace(f.Example)
	if len(f.PartsOfSpeech) == 0 && f.PartOfSpeech != "" {
		f.PartsOfSpeech = []string{f.PartOfSpeech}
	}
	if len(f.Meanings) == 0 && f.Meaning != "" {
		f.Meanings = []string{f.Meaning}
	}
	var valid bool
	f.PartsOfSpeech, valid = cleanList(f.PartsOfSpeech)
	if !valid {
		return Fields{}, ErrInvalid
	}
	f.Meanings, valid = cleanList(f.Meanings)
	if !valid || f.Word == "" {
		return Fields{}, ErrInvalid
	}
	f.PartOfSpeech = strings.Join(f.PartsOfSpeech, ", ")
	f.Meaning = strings.Join(f.Meanings, ", ")
	letters := []rune(f.Word)
	letters[0] = unicode.ToUpper(letters[0])
	f.Word = string(letters)
	return f, nil
}

func cleanList(values []string) ([]string, bool) {
	if len(values) == 0 {
		return nil, false
	}
	clean := make([]string, 0, len(values))
	seen := make(map[string]bool, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			return nil, false
		}
		key := strings.ToLower(value)
		if !seen[key] {
			clean = append(clean, value)
			seen[key] = true
		}
	}
	return clean, true
}

// StudyDay summarizes the challenge answers given on one calendar day.
type StudyDay struct {
	Date    string `json:"date"`
	Answers int    `json:"answers"`
	Correct int    `json:"correct"`
}

const DayLayout = "2006-01-02"

// ReviewIntervals are the days to wait after each correct answer in a row.
var ReviewIntervals = []int{1, 3, 7, 14, 30, 60}

// NextReview schedules a card after an answer given on today.
// A wrong answer starts over and keeps the card due today; a correct one waits longer each time.
func NextReview(step int, correct bool, today time.Time) (int, time.Time) {
	if !correct {
		return 0, today
	}
	if step < len(ReviewIntervals) {
		step++
	}
	if step < 1 {
		step = 1
	}
	return step, today.AddDate(0, 0, ReviewIntervals[step-1])
}

// ParseDay reads the learner's local date; an empty value falls back to the server's UTC date.
func ParseDay(value string, now time.Time) (time.Time, error) {
	if value == "" {
		return time.Date(now.UTC().Year(), now.UTC().Month(), now.UTC().Day(), 0, 0, 0, 0, time.UTC), nil
	}
	day, err := time.Parse(DayLayout, value)
	if err != nil {
		return time.Time{}, ErrInvalid
	}
	return day, nil
}
