package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/IBM/sarama"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"

	"github.com/example/iam-service/internal/revoker"
)

var revokedCounter = prometheus.NewCounterVec(
	prometheus.CounterOpts{
		Name: "tokens_revoked_total",
		Help: "Number of tokens revoked",
	},
	[]string{"reason"},
)

func main() {
	_ = godotenv.Load()
	brokers := getEnv("KAFKA_BROKERS", "localhost:9092")
	pgdsn := getEnv("POSTGRES_DSN", "postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable")
	redisURL := getEnv("REDIS_URL", "redis://localhost:6379/0")
	groupID := getEnv("KAFKA_GROUP", "token-revoker")
	metricsAddr := getEnv("METRICS_ADDR", ":9104")

	prometheus.MustRegister(revokedCounter)
	go func() {
		http.Handle("/metrics", promhttp.Handler())
		log.Printf(`{"msg":"metrics server running","addr":"%s"}`+"\n", metricsAddr)
		if err := http.ListenAndServe(metricsAddr, nil); err != nil {
			log.Fatalf(`{"msg":"metrics server error","err":"%v"}`+"\n", err)
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	pool, err := pgxpool.New(ctx, pgdsn)
	if err != nil {
		log.Fatalf(`{"msg":"pg connect error","err":"%v"}`+"\n", err)
	}
	defer pool.Close()

	rdbOpts, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatalf(`{"msg":"redis parse url error","err":"%v"}`+"\n", err)
	}
	rdb := redis.NewClient(rdbOpts)
	defer func() { _ = rdb.Close() }()

	cfg := sarama.NewConfig()
	cfg.Version = sarama.V2_5_0_0
	cfg.Consumer.Group.Rebalance.Strategy = sarama.NewBalanceStrategyRoundRobin()

	consumer := &consumerGroupHandler{pool: pool, rdb: rdb}
	cg, err := sarama.NewConsumerGroup(strings.Split(brokers, ","), groupID, cfg)
	if err != nil {
		log.Fatalf(`{"msg":"kafka connect error","err":"%v"}`+"\n", err)
	}
	defer func() { _ = cg.Close() }()

	for {
		if err := cg.Consume(ctx, []string{"alerts"}, consumer); err != nil {
			log.Printf(`{"msg":"consume error","err":"%v"}`+"\n", err)
		}
		if ctx.Err() != nil {
			break
		}
	}
}

type consumerGroupHandler struct {
	pool *pgxpool.Pool
	rdb  *redis.Client
}

func (h *consumerGroupHandler) Setup(s sarama.ConsumerGroupSession) error   { return nil }
func (h *consumerGroupHandler) Cleanup(s sarama.ConsumerGroupSession) error { return nil }

func (h *consumerGroupHandler) ConsumeClaim(sess sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
	for msg := range claim.Messages() {
		var alert revoker.Alert
		if err := json.Unmarshal(msg.Value, &alert); err != nil {
			log.Printf(`{"msg":"unmarshal error","err":"%v"}`+"\n", err)
			sess.MarkMessage(msg, "")
			continue
		}
		if !revoker.ShouldProcess(alert) {
			sess.MarkMessage(msg, "")
			continue
		}
		if err := h.process(sess.Context(), alert); err != nil {
			log.Printf(`{"msg":"process error","err":"%v"}`+"\n", err)
		}
		sess.MarkMessage(msg, "")
	}
	return nil
}

func (h *consumerGroupHandler) process(ctx context.Context, alert revoker.Alert) error {
	tx, err := h.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtext($1))", alert.UserID); err != nil {
		return err
	}

	tag, err := tx.Exec(ctx, "INSERT INTO revoked_alerts(alert_id) VALUES($1) ON CONFLICT DO NOTHING", alert.ID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return tx.Commit(ctx)
	}

	if alert.JTI != "" {
		if err := h.revokeToken(ctx, tx, alert.JTI, alert); err != nil {
			return err
		}
	} else {
		rows, err := tx.Query(ctx, "SELECT jwt_id FROM sessions WHERE user_id=$1 AND revoked=false", alert.UserID)
		if err != nil {
			return err
		}
		var jt []string
		for rows.Next() {
			var j string
			if err := rows.Scan(&j); err != nil {
				rows.Close()
				return err
			}
			jt = append(jt, j)
		}
		rows.Close()
		for _, j := range jt {
			if err := h.revokeToken(ctx, tx, j, alert); err != nil {
				return err
			}
		}
		if _, err := tx.Exec(ctx, "UPDATE sessions SET revoked=true WHERE user_id=$1 AND revoked=false", alert.UserID); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (h *consumerGroupHandler) revokeToken(ctx context.Context, tx pgx.Tx, jti string, alert revoker.Alert) error {
	key := "jwt:blacklist:" + jti
	if err := h.rdb.Set(ctx, key, "1", 24*time.Hour).Err(); err != nil {
		return err
	}
	_, err := tx.Exec(ctx,
		"INSERT INTO token_revocations(id, jti, user_id, alert_id, revoked_at) VALUES (gen_random_uuid(), $1, $2, $3, now())",
		jti, alert.UserID, alert.ID,
	)
	revokedCounter.WithLabelValues("account_compromise").Inc()
	return err
}

func getEnv(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
