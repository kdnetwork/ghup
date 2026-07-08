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
	"strconv"
	"time"

	"github.com/kdnetwork/ghup/go-sdk/assets"
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

	s, err := os.Stat(tmpPath)
	if err != nil {
		return err
	}
	if s.Size() != int64(u.Asset.Size) {
		return errors.New("invalid file size")
	}

	slog.Debug("replace file", "path", u.System.ExePath)

	win_upgrade_script_template, _ := assets.Scripts.ReadFile("scripts/win_upgrade_script_template.ps1")

	args, _ := json.Marshal(os.Args[1:])

	autoRestartVal := "$false"
	if restart {
		autoRestartVal = "$true"
	}

	psScript := fmt.Sprintf(string(win_upgrade_script_template), u.System.ExePath, tmpPath, u.System.Pid, args, autoRestartVal, u.System.WorkDir)

	psFile := filepath.Join(filepath.Dir(u.System.ExePath), "."+now+"_"+fileName+"_ghup.ps1")
	if err := os.WriteFile(psFile, []byte(psScript), 0o644); err != nil {
		return err
	}

	var cmd *exec.Cmd
	if u.System.WindowsGUI == UpdaterVisibleConsole {
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
