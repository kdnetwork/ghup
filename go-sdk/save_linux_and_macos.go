//go:build !windows

package ghup

import (
	"errors"
	"log/slog"
	"os"
	"path/filepath"
	"strconv"
	"syscall"
	"time"
)

func (u *UpdateContent) Save(restart bool) error {
	// Path to the new tagName temporary file
	now := strconv.Itoa(int(time.Now().UnixMilli()))
	fileName := u.Asset.Name
	if fileName == "" {
		fileName = "ghup_asset.tmp"
	}
	tmpPath := filepath.Join(filepath.Dir(u.System.ExePath), "."+now+"_"+fileName)

	if err := os.WriteFile(tmpPath, u.Asset.Binary, 0o644); err != nil {
		return err
	}
	defer os.Remove(tmpPath)

	s, err := os.Stat(tmpPath)
	if err != nil {
		return err
	}
	if s.Size() != int64(u.Asset.Size) {
		return errors.New("invalid file size")
	}

	slog.Debug("replace file", "path", u.System.ExePath)

	os.Chmod(tmpPath, 0o755)
	err = os.Rename(tmpPath, u.System.ExePath)
	if err != nil {
		return err
	}

	if restart {
		return syscall.Exec(u.System.ExePath, os.Args, os.Environ())
	}

	return nil
}
