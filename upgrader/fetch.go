package main

import (
	"bytes"
	"fmt"
	"io"
	"log/slog"
	"maps"
	"mime"
	"net/http"
	"runtime"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/kdnetwork/code-snippet/go/utils"
)

var DefaultClient = new(http.Client)

var DefaultUserAgent = "kdnetwork/ghup-upgrader"

var useFormMethods = []string{http.MethodPost, http.MethodPut, http.MethodPatch}

var DefaultHeaderMap = make(map[string]string, 0)

func (u UpdateContent) Fetch(_url string, _method string, _body []byte, _headers map[string]string) (*http.Response, []byte, error) {
	var body io.Reader

	if len(_body) > 0 {
		body = bytes.NewReader(_body)
	}

	req, err := http.NewRequest(_method, _url, body)
	if err != nil {
		slog.Debug("init fetch failed", "error", err)
		return nil, nil, err
	}

	req.Header.Set("User-Agent", DefaultUserAgent)
	if slices.Contains(useFormMethods, strings.ToUpper(_method)) {
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}

	for k, v := range u.Headers {
		req.Header.Set(k, v)
	}

	for k, v := range _headers {
		req.Header.Set(k, v)
	}

	var c *http.Client
	if u.Client != nil {
		c = u.Client
	} else {
		c = DefaultClient
	}

	resp, err := c.Do(req)
	if err != nil {
		slog.Debug("do fetch request", "error", err)
		return resp, nil, err
	}
	defer resp.Body.Close()
	response, err := io.ReadAll(resp.Body)
	if err != nil {
		slog.Debug("read fetch response", "error", err)
		return resp, nil, err
	}

	if u.TestMode {
		strResponse := "[binary file]"
		if contentType, ok := resp.Header["Content-Type"]; ok && len(contentType) > 0 {
			mediatype, _, _ := mime.ParseMediaType(contentType[0])
			if slices.Contains([]string{"html", "txt", "json", "xml", "javascript", "x-javascript"}, strings.ReplaceAll(strings.ReplaceAll(mediatype, "application/", ""), "text/", "")) {
				strResponse = string(response)
			}
		}

		fmt.Printf(`
===== TEST MODE FETCH =====

Request
  URL:     %s
  Method:  %s
  Body:    %v
  Headers: %v

Response
  Status:  %d
  Headers: %v
  Body:
%s

===========================

`, _url, _method, _body, req.Header, resp.StatusCode, resp.Header, strResponse)
	}

	return resp, response, err
}

type chunk struct {
	start int
	end   int
	index int
	data  []byte
	err   error
}

// by chatgpt

func FormatSpeedMB(bytes int64, duration time.Duration) string {
	if duration <= 0 {
		return "∞ MB/s"
	}
	mbPerSec := float64(bytes) / 1024 / 1024 / duration.Seconds()
	return fmt.Sprintf("%.2f MB/s", mbPerSec)
}
func (u *UpdateContent) UpgradeDownloader(_url string, _headers map[string]string) error {
	// get response headers
	resp, _, err := u.Fetch(_url, http.MethodHead, nil, _headers)

	lengthStr := resp.Header.Get("Content-Length")
	if lengthStr == "" {
		_, body, err := u.Fetch(_url, http.MethodGet, nil, _headers)
		u.Asset.Binary = body
		return err
	}

	length, err := strconv.Atoi(lengthStr)
	if err != nil || length <= 0 {
		_, body, err := u.Fetch(_url, http.MethodGet, nil, _headers)
		u.Asset.Binary = body
		return err
	}

	// Range?
	if resp.Header.Get("Accept-Ranges") != "bytes" {
		_, body, err := u.Fetch(_url, http.MethodGet, nil, _headers)
		u.Asset.Binary = body
		return err
	}

	workers := utils.Clamp(runtime.NumCPU(), 4, 8)

	chunkSize := length / workers

	chunks := make([]*chunk, workers)

	var wg sync.WaitGroup
	wg.Add(workers)

	// concurrent
	for i := range workers {
		start := i * chunkSize
		end := start + chunkSize - 1

		if i == workers-1 {
			end = length - 1
		}

		chunks[i] = &chunk{
			start: start,
			end:   end,
			index: i,
		}

		go func(c *chunk) {
			defer wg.Done()

			_headers2 := maps.Clone(_headers)
			_headers2["Range"] = fmt.Sprintf("bytes=%d-%d", c.start, c.end)

			_, data, err := u.Fetch(_url, http.MethodGet, nil, _headers2)

			if err != nil {
				c.err = err
				return
			}

			slog.Debug("download status", slog.Group("download",
				slog.Int("size", len(data)),
				slog.Int("part", i),
				slog.String("range", _headers2["Range"]),
			))

			c.data = data
		}(chunks[i])
	}

	wg.Wait()

	// check
	for _, c := range chunks {
		if c.err != nil {
			return c.err
		}
	}

	// concat chunks
	var buf bytes.Buffer
	for _, c := range chunks {
		buf.Write(c.data)
	}

	u.Asset.Binary = buf.Bytes()

	return nil
}
