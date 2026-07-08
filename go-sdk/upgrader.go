package ghup

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"runtime"
)

type UpdaterMode int

const (
	UpdaterSilent UpdaterMode = iota
	UpdaterVisibleConsole
)

type VerifyLocation int

const (
	VerifyLocationBeforeCheck VerifyLocation = iota
	VerifyLocationBeforeDownload
	VerifyLocationAfterDownload
)

type UpdateContent struct {
	// uri prefix
	APIPrefix string

	// http requests
	Headers map[string]string
	Client  *http.Client

	// custom verify
	CustomVerify func(*UpdateContent, int) error

	TestMode bool

	System struct {
		ExePath string
		WorkDir string
		Pid     int

		WindowsGUI UpdaterMode
	}

	Asset struct {
		Info   *ReleaseInfoStruct
		Binary []byte
		Name   string
		Hash   string
		Size   int
		URL    string
	}
}

// NewUpgrader exp repo `kdnetwork/ghup`
func NewUpgrader(repo string) *UpdateContent {
	exePath, _ := os.Executable()
	workdir, _ := os.Getwd()
	pid := os.Getpid()

	ctx := &UpdateContent{
		APIPrefix: "https://api.github.com/repos/" + repo, // upgrade2/upgrade1
		Headers:   make(map[string]string),
	}

	ctx.System.ExePath = exePath
	ctx.System.WorkDir = workdir
	ctx.System.Pid = pid

	return ctx
}

func (u *UpdateContent) Upgrade2(tagName string) error {
	if !Supported() {
		return fmt.Errorf("not support (%s/%s)", runtime.GOOS, runtime.GOARCH)
	} else if _, err := url.Parse(u.APIPrefix + "/releases/tags/"); err != nil {
		return errors.New("invalid uri")
	}

	if u.CustomVerify != nil {
		if err := u.CustomVerify(u, int(VerifyLocationBeforeCheck)); err != nil {
			return err
		}
	}

	if err := u.UpdateReleaseInfo(tagName); err != nil {
		return err
	}

	if err := u.MatchAsset(); err != nil {
		return err
	}

	if err := u.Download(); err != nil {
		return err
	}

	return u.Verify()
}
