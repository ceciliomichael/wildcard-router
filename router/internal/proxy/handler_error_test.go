package proxy

import (
	"context"
	"errors"
	"net/http"
	"testing"
)

func TestClassifyUpstreamErrorReturnsGatewayTimeoutForTimeouts(t *testing.T) {
	t.Parallel()

	handler := &Handler{}

	if got := handler.classifyUpstreamError(context.DeadlineExceeded); got != http.StatusGatewayTimeout {
		t.Fatalf("unexpected status for deadline exceeded: got %d want %d", got, http.StatusGatewayTimeout)
	}

	if got := handler.classifyUpstreamError(errors.New("net/http: timeout awaiting response headers")); got != http.StatusGatewayTimeout {
		t.Fatalf("unexpected status for timeout text: got %d want %d", got, http.StatusGatewayTimeout)
	}
}

func TestClassifyUpstreamErrorReturnsBadGatewayForConnectionFailures(t *testing.T) {
	t.Parallel()

	handler := &Handler{}

	if got := handler.classifyUpstreamError(errors.New("dial tcp 10.0.0.1:443: connect: connection refused")); got != http.StatusBadGateway {
		t.Fatalf("unexpected status for connection failure: got %d want %d", got, http.StatusBadGateway)
	}
}
