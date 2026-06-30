//go:build !windows

package ghup

import (
	"errors"
	"log/slog"
	"os"
	"path/filepath"
	"syscall"

	"github.com/google/uuid"
)

func (u *UpdateContent) Save(restart bool) error {
	// Path to the new tagName temporary file
	tmpUUID := uuid.New().String()
	tmpPath := filepath.Join(filepath.Dir(u.System.ExePath), "."+tmpUUID+"_ghup_asset.tmp")

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
