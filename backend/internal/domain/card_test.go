package domain

import "testing"

func TestFieldsClean(t *testing.T) {
	clean, err := (Fields{Word: "  run  ", PartOfSpeech: " verb ", Meaning: " วิ่ง "}).Clean()
	if err != nil || clean.Word != "run" || clean.PartOfSpeech != "verb" || clean.Meaning != "วิ่ง" {
		t.Fatalf("unexpected result: %#v, %v", clean, err)
	}
	if _, err := (Fields{Word: "run", PartOfSpeech: " ", Meaning: "วิ่ง"}).Clean(); err != ErrInvalid {
		t.Fatalf("expected ErrInvalid, got %v", err)
	}
}
