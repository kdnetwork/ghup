package ghup

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"strings"

	"github.com/google/uuid"
	"github.com/kdnetwork/ghup/upgrader/assets"
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
		return u.CustomVerify()
	}

	return nil
}

func (u *UpdateContent) Save() error {
	// Path to the new tagName temporary file
	tmpUUID := uuid.New().String()
	tmpPath := filepath.Join(os.TempDir(), tmpUUID)

	out, err := os.Create(tmpPath)
	if err != nil {
		return err
	}
	defer out.Close()

	file, err := os.Open(tmpPath)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = io.Copy(out, bytes.NewReader(u.Asset.Binary))
	if err != nil {
		return err
	}

	s, err := file.Stat()
	if err != nil {
		return err
	}
	if s.Size() != int64(u.Asset.Size) {
		return errors.New("invalid file size")
	}

	execPath, err := os.Executable()
	if err != nil {
		return err
	}
	slog.Debug("replace file", "path", execPath)

	if runtime.GOOS != "windows" {
		os.Chmod(tmpPath, 0755)
		err = os.Rename(tmpPath, execPath)
		if err != nil {
			return err
		}
	} else {
		win_upgrade_script_template, _ := assets.Scripts.ReadFile("scripts/win_upgrade_script_template.ps1")

		psScript := fmt.Sprintf(string(win_upgrade_script_template), execPath, tmpPath)

		psFile := filepath.Join(os.TempDir(), tmpUUID+"_ghup_win_upgrade_script.ps1")
		if err := os.WriteFile(psFile, []byte(psScript), 0644); err != nil {
			return err
		}

		cmd := exec.Command("powershell", "-ExecutionPolicy", "Bypass", "-File", psFile)
		if err := cmd.Start(); err != nil {
			return err
		}
	}

	return nil
}
