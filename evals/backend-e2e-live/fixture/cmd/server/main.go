package main

import (
	"log"
	"net/http"
	"os"

	"example.com/viberig/invitefixture/internal/invites"
)

func main() {
	port := envOr("PORT", "18080")
	store, err := invites.NewStore(envOr("DATA_PATH", ".tmp/state.json"))
	if err != nil {
		log.Fatal(err)
	}
	address := "127.0.0.1:" + port
	log.Printf("invitation fixture listening on %s", address)
	if err := http.ListenAndServe(address, invites.NewHandler(store)); err != nil {
		log.Fatal(err)
	}
}

func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
