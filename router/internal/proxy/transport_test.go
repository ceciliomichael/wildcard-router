package proxy

import "testing"

func TestNewUpstreamDialerUsesFastConnectTimeout(t *testing.T) {
	t.Parallel()

	dialer := newUpstreamDialer()
	if dialer.Timeout != upstreamConnectTimeout {
		t.Fatalf("unexpected connect timeout: got %s want %s", dialer.Timeout, upstreamConnectTimeout)
	}
}

func TestNewUpstreamTransportSetsTimeouts(t *testing.T) {
	t.Parallel()

	transport := newUpstreamTransport(false)

	if transport.ResponseHeaderTimeout != upstreamResponseHeaderTimeout {
		t.Fatalf("unexpected response header timeout: got %s want %s", transport.ResponseHeaderTimeout, upstreamResponseHeaderTimeout)
	}
	if transport.TLSHandshakeTimeout != upstreamTLSHandshakeTimeout {
		t.Fatalf("unexpected TLS handshake timeout: got %s want %s", transport.TLSHandshakeTimeout, upstreamTLSHandshakeTimeout)
	}
	if transport.ExpectContinueTimeout != upstreamExpectContinueTimeout {
		t.Fatalf("unexpected expect-continue timeout: got %s want %s", transport.ExpectContinueTimeout, upstreamExpectContinueTimeout)
	}
}
