package revoker

import (
	"encoding/json"
)

type Alert struct {
	ID       string `json:"id"`
	Class    string `json:"class"`
	Severity string `json:"severity"`
	UserID   string `json:"user_id"`
	JTI      string `json:"jti"`
}

var severities = map[string]struct{}{"High": {}, "Critical": {}}

func ShouldProcess(a Alert) bool {
	if a.Class != "Account Compromise" {
		return false
	}
	_, ok := severities[a.Severity]
	return ok
}

func ParseAlert(b []byte) (Alert, error) {
	var a Alert
	err := json.Unmarshal(b, &a)
	return a, err
}
