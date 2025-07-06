package revoker

import "testing"

func TestShouldProcess(t *testing.T) {
	cases := []struct {
		a    Alert
		want bool
	}{
		{Alert{Class: "Account Compromise", Severity: "High"}, true},
		{Alert{Class: "Account Compromise", Severity: "Critical"}, true},
		{Alert{Class: "Account Compromise", Severity: "Low"}, false},
		{Alert{Class: "Other", Severity: "High"}, false},
	}
	for i, c := range cases {
		if got := ShouldProcess(c.a); got != c.want {
			t.Errorf("case %d: expected %v got %v", i, c.want, got)
		}
	}
}

func TestParseAlert(t *testing.T) {
	b := []byte(`{"id":"1","class":"Account Compromise","severity":"High","user_id":"u","jti":"j"}`)
	a, err := ParseAlert(b)
	if err != nil {
		t.Fatal(err)
	}
	if a.ID != "1" || a.Class != "Account Compromise" || a.Severity != "High" || a.UserID != "u" || a.JTI != "j" {
		t.Fatalf("unexpected alert: %+v", a)
	}
}
