package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"example.com/teamfixture/internal/invitations"
)

type invitationCreator interface {
	CreateFromRequest(role string, email string) error
}

func Handler(service invitationCreator) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/invitations", func(writer http.ResponseWriter, request *http.Request) {
		var body struct {
			Email string `json:"email"`
		}
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			http.Error(writer, "invalid request", http.StatusBadRequest)
			return
		}
		if err := service.CreateFromRequest(request.Header.Get("X-Role"), body.Email); err != nil {
			if errors.Is(err, invitations.ErrForbidden) {
				http.Error(writer, "forbidden", http.StatusForbidden)
				return
			}
			http.Error(writer, "internal error", http.StatusInternalServerError)
			return
		}
		writer.WriteHeader(http.StatusCreated)
	})
	return mux
}
