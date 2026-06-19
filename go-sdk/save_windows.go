//go:build windows

package ghup

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/google/uuid"
	"github.com/kdnetwork/ghup/go-sdk/assets"
)

func (u *UpdateContent) Save() error {
	// Path to the new tagName temporary file
	tmpUUID := uuid.New().String()
	tmpPath := filepath.Join(os.TempDir(), tmpUUID+"_ghup_asset.tmp")

	if err := os.WriteFile(tmpPath, u.Asset.Binary, 0o644); err != nil {
		return err
	}

	s, err := os.Stat(tmpPath)
	if err != nil {
		return err
	}
	if s.Size() != int64(u.Asset.Size) {
		return errors.New("invalid file size")
	}

	slog.Debug("replace file", "path", u.ExePath)

	win_upgrade_script_template, _ := assets.Scripts.ReadFile("scripts/win_upgrade_script_template.ps1")

	args, _ := json.Marshal(os.Args[1:])

	autoRestartVal := "$false"
	if u.AutoRestart {
		autoRestartVal = "$true"
	}

	psScript := fmt.Sprintf(string(win_upgrade_script_template), u.ExePath, tmpPath, os.Getpid(), args, autoRestartVal)

	psFile := filepath.Join(os.TempDir(), tmpUUID+"_ghup_win_upgrade_script.ps1")
	if err := os.WriteFile(psFile, []byte(psScript), 0o644); err != nil {
		return err
	}

	var cmd *exec.Cmd
	if u.WindowsGUI == UpdaterVisibleConsole {
		cmd = exec.Command("cmd",
			"/C", "start", "",
			"powershell", "-ExecutionPolicy", "Bypass", "-File", psFile,
		)
	} else {
		cmd = exec.Command("powershell", "-ExecutionPolicy", "Bypass", "-File", psFile)
	}

	if err := cmd.Start(); err != nil {
		return err
	}

	return nil
}
