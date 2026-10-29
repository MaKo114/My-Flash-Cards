package domain

import "testing"

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
