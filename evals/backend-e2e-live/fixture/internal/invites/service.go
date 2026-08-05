package invites

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type behavior struct {
	enforceAdmin             bool
	persistInvite            bool
	sendMail                 bool
	leakForbiddenSideEffects bool
}

type Invitation struct {
	ID     string `json:"id"`
	TeamID string `json:"teamId"`
	Email  string `json:"email"`
}

type Mail struct {
	To      string `json:"to"`
	Subject string `json:"subject"`
}

type State struct {
	Invitations []Invitation `json:"invitations"`
	Mails       []Mail       `json:"mails"`
}

type Store struct {
	mu    sync.Mutex
	path  string
	state State
}

func NewStore(path string) (*Store, error) {
	store := &Store{path: path, state: State{Invitations: []Invitation{}, Mails: []Mail{}}}
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return store, nil
	}
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(data, &store.state); err != nil {
		return nil, err
	}
	return store, nil
}

func (s *Store) snapshot() State {
	s.mu.Lock()
	defer s.mu.Unlock()
	return State{
		Invitations: append([]Invitation(nil), s.state.Invitations...),
		Mails:       append([]Mail(nil), s.state.Mails...),
	}
}

func (s *Store) reset() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.state = State{Invitations: []Invitation{}, Mails: []Mail{}}
	return s.saveLocked()
}

func (s *Store) addInvitation(invitation Invitation) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.state.Invitations = append(s.state.Invitations, invitation)
	return s.saveLocked()
}

func (s *Store) addMail(mail Mail) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.state.Mails = append(s.state.Mails, mail)
	return s.saveLocked()
}

func (s *Store) saveLocked() error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(s.state, "", "  ")
	if err != nil {
		return err
	}
	temporary := s.path + ".tmp"
	if err := os.WriteFile(temporary, data, 0o600); err != nil {
		return err
	}
	return os.Rename(temporary, s.path)
}

func NewHandler(store *Store) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write([]byte("ok"))
	})
	mux.HandleFunc("POST /teams/{teamID}/invitations", func(writer http.ResponseWriter, request *http.Request) {
		handleCreateInvitation(store, writer, request)
	})
	mux.HandleFunc("GET /__test/state", func(writer http.ResponseWriter, request *http.Request) {
		if !allowTestAccess(request) {
			http.Error(writer, "forbidden", http.StatusForbidden)
			return
		}
		writeJSON(writer, http.StatusOK, store.snapshot())
	})
	mux.HandleFunc("DELETE /__test/reset", func(writer http.ResponseWriter, request *http.Request) {
		if !allowTestAccess(request) {
			http.Error(writer, "forbidden", http.StatusForbidden)
			return
		}
		if err := store.reset(); err != nil {
			http.Error(writer, err.Error(), http.StatusInternalServerError)
			return
		}
		writer.WriteHeader(http.StatusNoContent)
	})
	return mux
}

func handleCreateInvitation(store *Store, writer http.ResponseWriter, request *http.Request) {
	token := strings.TrimPrefix(request.Header.Get("Authorization"), "Bearer ")
	if token != "admin-token" && token != "member-token" {
		http.Error(writer, "unauthorized", http.StatusUnauthorized)
		return
	}
	if activeBehavior.enforceAdmin && token != "admin-token" {
		if activeBehavior.leakForbiddenSideEffects {
			go func() {
				time.Sleep(120 * time.Millisecond)
				_ = store.addInvitation(Invitation{
					ID:     fmt.Sprintf("leaked-inv-%d", time.Now().UnixNano()),
					TeamID: "team-1",
					Email:  "blocked@example.com",
				})
				_ = store.addMail(Mail{To: "blocked@example.com", Subject: "Leaked team invitation"})
			}()
		}
		http.Error(writer, "forbidden", http.StatusForbidden)
		return
	}
	var input struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(request.Body).Decode(&input); err != nil || input.Email == "" {
		http.Error(writer, "invalid email", http.StatusBadRequest)
		return
	}
	invitation := Invitation{
		ID:     fmt.Sprintf("inv-%d", time.Now().UnixNano()),
		TeamID: request.PathValue("teamID"),
		Email:  input.Email,
	}
	if activeBehavior.persistInvite {
		if err := store.addInvitation(invitation); err != nil {
			http.Error(writer, err.Error(), http.StatusInternalServerError)
			return
		}
	}
	if activeBehavior.sendMail {
		go func() {
			time.Sleep(40 * time.Millisecond)
			_ = store.addMail(Mail{To: input.Email, Subject: "Team invitation"})
		}()
	}
	writeJSON(writer, http.StatusCreated, invitation)
}

func allowTestAccess(request *http.Request) bool {
	return request.Header.Get("X-Test-Key") == "fixture-key"
}

func writeJSON(writer http.ResponseWriter, status int, value any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(value)
}
