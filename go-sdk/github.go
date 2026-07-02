package ghup

import (
	"crypto/hmac"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"maps"
	"net/http"
	"runtime"
	"strconv"
	"strings"
	"time"
)

type ReleaseInfoWebhookPayload struct {
	Action  string            `json:"action"`
	Release ReleaseInfoStruct `json:"release"`
}

type ReleaseInfoAsset struct {
	URL                string    `json:"url"`
	ID                 int       `json:"id"`
	Name               string    `json:"name"` // <-
	State              string    `json:"state"`
	Size               int       `json:"size"`   // <-
	Digest             string    `json:"digest"` // <-
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
	BrowserDownloadURL string    `json:"browser_download_url"`
}

// https://api.github.com/repos/${{name}}/${{repo}}/releases []ReleaseInfoStruct
// https://api.github.com/repos/${{name}}/${{repo}}/releases/tags/${{tag}} ReleaseInfoStruct
type ReleaseInfoStruct struct {
	ID          int                `json:"id"` // <-
	TagName     string             `json:"tag_name"`
	CreatedAt   time.Time          `json:"created_at"`
	UpdatedAt   time.Time          `json:"updated_at"`
	PublishedAt time.Time          `json:"published_at"`
	Draft       bool               `json:"draft"`
	Immutable   bool               `json:"immutable"`
	Prerelease  bool               `json:"prerelease"`
	Assets      []ReleaseInfoAsset `json:"assets"`
	Body        string             `json:"body"`
}

func (u *UpdateContent) UpdateReleaseInfo(tagName string) error {
	if tagName == "" {
		// get info
		_, releasesBody, err := u.Fetch(u.APIPrefix+"/releases?per_page=1", http.MethodGet, nil, DefaultHeaderMap)
		if err != nil {
			return err
		}

		var releasesList []*ReleaseInfoStruct
		err = json.Unmarshal(releasesBody, &releasesList)
		if err != nil {
			return err
		}

		if len(releasesList) > 0 {
			u.Asset.Info = releasesList[0]
			return nil
		}
		return errors.New("no releases found")
	}

	// get info by tagName
	_, tagBody, err := u.Fetch(u.APIPrefix+"/releases/tags/"+tagName, http.MethodGet, nil, DefaultHeaderMap)
	if err != nil {
		return err
	}

	var tagInfo ReleaseInfoStruct
	err = json.Unmarshal(tagBody, &tagInfo)
	if err != nil {
		return err
	}

	if tagInfo.TagName != tagName {
		return errors.New("invalid version")
	}

	u.Asset.Info = &tagInfo

	return nil
}

func (u *UpdateContent) MatchAsset() error {
	_os := runtime.GOOS
	_arch := runtime.GOARCH

	info := u.Asset.Info

	if info == nil || len(info.Assets) == 0 {
		return errors.New("no asset")
	}

	// find binary
	binName := info.TagName + "." + _os + "-" + _arch

	if _os == "windows" {
		binName += ".exe"
	}

	for _, asset := range info.Assets {
		if asset.Name == binName {
			u.Asset.URL = u.APIPrefix + "/releases/assets/" + strconv.Itoa(asset.ID)
			u.Asset.Hash = strings.TrimSpace(strings.ReplaceAll(asset.Digest, "sha256:", ""))
			u.Asset.Size = asset.Size
			break
		}
	}
	if u.Asset.URL == "" {
		return errors.New("no downloaded binary")
	}

	if u.CustomVerify != nil {
		if err := u.CustomVerify(u, int(VerifyLocationBeforeDownload)); err != nil {
			return err
		}
	}

	return nil
}

func (u *UpdateContent) Download() error {
	if u.Asset.URL == "" {
		return errors.New("asset URL not found, call MatchAsset first")
	}

	// get binary
	since := time.Now()
	binaryHeaderMap := maps.Clone(DefaultHeaderMap)
	binaryHeaderMap["Accept"] = "application/octet-stream"
	err := u.UpgradeDownloader(u.Asset.URL, binaryHeaderMap)
	if err != nil {
		return err
	}

	duration := time.Since(since)
	slog.Info("download status", slog.Group("download",
		slog.Int("duration", int(duration.Seconds())),
		slog.String("avg-speed", FormatSpeedMB(int64(len(u.Asset.Binary)), duration)),
	))

	return nil
}

// Content-Type should use application/json
func VerifyWebhook(event, hmac256Key, sig256 string, body []byte) error {
	if hmac256Key != "" {
		// Verify signature
		actualSig, err := hex.DecodeString(sig256)
		if err != nil {
			return errors.New("invalid signature")
		} else if !hmac.Equal(actualSig, GenHMAC256(body, []byte(hmac256Key))) {
			return errors.New("invalid signature")
		}
	}

	// Verify event type
	if event != "release" {
		return errors.New("invalid event type")
	}

	return nil
}

func ParseWebhookPayload(body []byte) (*ReleaseInfoWebhookPayload, error) {
	var payload ReleaseInfoWebhookPayload
	err := json.Unmarshal(body, &payload)

	return &payload, err
}
