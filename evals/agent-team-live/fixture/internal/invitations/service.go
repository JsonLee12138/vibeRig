package invitations

import "errors"

var ErrForbidden = errors.New("administrator role required")

type Store interface {
	Create(email string) error
}

type Service struct {
	store Store
}

func NewService(store Store) *Service { return &Service{store: store} }

// CreateFromRequest should reject non-admin callers, but the role check is missing.
func (service *Service) CreateFromRequest(role string, email string) error {
	return service.store.Create(email)
}
