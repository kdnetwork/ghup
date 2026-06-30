package ghup

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"log/slog"
	"runtime"
	"slices"
	"strings"
)

var OSArchList = map[string][]string{
	"darwin":  {"amd64", "arm64"},
	"linux":   {"amd64", "arm64"},
	"windows": {"amd64"},
}

func Supported() bool {
	list, ok := OSArchList[runtime.GOOS]
	return ok && slices.Contains(list, runtime.GOARCH)
}

func (u *UpdateContent) Verify() error {
	// diff sha256
	hasher := sha256.Sum256(u.Asset.Binary)
	assetBinarySha256 := strings.ToLower(strings.TrimSpace(hex.EncodeToString(hasher[:])))

	slog.Info("verify file", slog.Group("fileinfo",
		slog.Int("size", len(u.Asset.Binary)),
		slog.String("calculated-sha256", assetBinarySha256),
		slog.String("expected-sha256", u.Asset.Hash),
	))

	if assetBinarySha256 == strings.ToLower(strings.TrimSpace(u.Asset.Hash)) && len(u.Asset.Binary) == u.Asset.Size {

	} else {
		return errors.New("invalid sha256 or file size")
	}

	if u.CustomVerify != nil {
		if err := u.CustomVerify(u, int(VerifyLocationAfterDownload)); err != nil {
			return err
		}
	}

	return nil
}
