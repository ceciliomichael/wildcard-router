package proxy

import (
	"crypto/tls"
	"net"
	"net/http"
	"time"
)

const (
	upstreamConnectTimeout         = 2 * time.Second
	upstreamTLSHandshakeTimeout    = 2 * time.Second
	upstreamResponseHeaderTimeout  = 3 * time.Second
	upstreamExpectContinueTimeout  = 1 * time.Second
	upstreamKeepAliveTimeout       = 30 * time.Second
)

func newUpstreamTransport(insecureSkipTLSVerify bool) *http.Transport {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	dialer := newUpstreamDialer()

	transport.DialContext = dialer.DialContext
	transport.TLSHandshakeTimeout = upstreamTLSHandshakeTimeout
	transport.ResponseHeaderTimeout = upstreamResponseHeaderTimeout
	transport.ExpectContinueTimeout = upstreamExpectContinueTimeout

	if insecureSkipTLSVerify {
		transport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	}

	return transport
}

func newUpstreamDialer() *net.Dialer {
	return &net.Dialer{
		Timeout:   upstreamConnectTimeout,
		KeepAlive: upstreamKeepAliveTimeout,
	}
}
