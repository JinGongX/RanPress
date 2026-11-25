package services

import (
	"changeme/internal/models"
	"context"
	"crypto/rand"
	"embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed assets/icon.png assets/winicon.png
var iconFS embed.FS

type AppService struct {
	App          *application.App
	SecondWindow *application.WebviewWindow
	Mainwindow   *application.WebviewWindow

	Config *AppConfigService

	Tray          *application.SystemTray
	I18nFS        embed.FS
	Menu          *application.Menu
	MenuQuit      *application.MenuItem
	MenuSetting   *application.MenuItem
	MenuSecondBar *application.MenuItem
	MenuVersion   *application.MenuItem
	MenuUpdate    *application.MenuItem
	UploadDir     string
}

var HotkeyShowSecondWindow = 1 // 显示第二个窗口的快捷键ID

func (a *AppService) SetApp(app *application.App, i18nFS embed.FS, suidb *SuiStore) {
	a.App = app
	a.I18nFS = i18nFS
	a.Config = NewAppConfigService(suidb)

	isWindows := runtime.GOOS == "windows"
	// Create a new window with the necessary options.
	// 'Title' is the title of the window.
	// 'Mac' options tailor the window when running on macOS.
	// 'BackgroundColour' is the background colour of the window.
	// 'URL' is the URL that will be loaded into the webview.
	mainwindow := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:     "main",
		Frameless: isWindows,
		Width:     1272,
		Height:    730,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		Windows: application.WindowsWindow{
			DisableIcon: true,
		},
		//BackgroundColour: application.NewRGB(27, 38, 54),
		URL: "/",
	})
	//add secondWindow
	// secondWindow := app.Window.NewWithOptions(application.WebviewWindowOptions{
	// 	Title:  "second",
	// 	Name:   "second",
	// 	Width:  340,
	// 	Height: 320,
	// 	//Frameless: true, // ✅ 去除边框
	// 	Mac: application.MacWindow{
	// 		InvisibleTitleBarHeight: 50,
	// 		//Backdrop:                application.MacBackdropTranslucent,
	// 		TitleBar: application.MacTitleBarHidden,
	// 		Backdrop: application.MacBackdropTransparent, // 可选：背景透明
	// 	},
	// 	BackgroundColour: application.NewRGB(27, 38, 54),
	// 	URL:              "/#/second",
	// })
	// secondWindow.Hide()
	// a.SecondWindow = secondWindow
	a.Mainwindow = mainwindow
	// Register the hotkey to show and focus the second window
	// RegisterWindowAndCallback(HotkeyShowSecondWindow, a.SecondWindow, func() {
	// 	if a.SecondWindow == nil {
	// 		return
	// 	}
	// 	//screen, _ := secondWindow.GetScreen()                            // 获取屏幕信息
	// 	//secondWindow.SetPosition((screen.X+screen.Size.Width-340)*2, 10) //+10
	// 	//hotkey.ActivateApp()
	// 	a.SecondWindow.Show()
	// 	a.SecondWindow.Focus() // 聚焦窗口
	// })

	a.Mainwindow.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		// Prevent the window from closing
		a.Mainwindow.Hide()
		e.Cancel() // 取消关闭事件
	})
	// 拦截关闭事件，改为隐藏窗口
	// a.SecondWindow.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
	// 	// Prevent the window from closing
	// 	a.SecondWindow.Hide()
	// 	e.Cancel() // 取消关闭事件
	// })

	//获取语言设置并创建托盘菜单
	appConfigService := NewAppConfigService(suidb)
	langvalue := appConfigService.GetLanguage()
	InitTray(a, i18nFS, langvalue)

	baseDir, err := os.UserConfigDir()
	if err != nil {
		panic(err)
	}
	uploadDir := filepath.Join(baseDir, "RanPress", "uploads")
	a.UploadDir = uploadDir
}

func (a *AppService) OpenSecondWindow() {
	if a.SecondWindow != nil {
		a.SecondWindow.Show()
	}
}

// 加载系统托盘菜单
func InitTray(a *AppService, i18nemb embed.FS, langvalue string) {
	a.Tray = a.App.SystemTray.New()

	iconBytes, _ := iconFS.ReadFile("assets/winicon.png")
	if runtime.GOOS == "darwin" {
		iconBytes, _ = iconFS.ReadFile("assets/icon.png")
	}

	a.Tray.SetIcon(iconBytes)
	if runtime.GOOS == "darwin" {
		a.Tray.SetTemplateIcon(iconBytes)
	}
	//a.Tray.SetLabel("Ran")
	LoadAppMenu(a, langvalue)
}

// 加载语言文件
func LoadLang(i18nemb embed.FS, lang string) (*models.Lang, error) {
	file := fmt.Sprintf("frontend/src/locales/%s.json", lang)
	data, err := i18nemb.ReadFile(file)
	if err != nil {
		return nil, err
	}
	var i18nva models.Lang
	err = json.Unmarshal(data, &i18nva)
	return &i18nva, err
}

// 创建托盘菜单具体项
func LoadAppMenu(a *AppService, langvalue string) {
	lang, langerr := LoadLang(a.I18nFS, langvalue)
	if langerr != nil {
		log.Fatal(langerr)
	}
	a.Menu = application.NewMenu()
	// a.MenuSecondBar = a.Menu.Add(lang.AppMenu.Second).OnClick(func(ctx *application.Context) {
	// 	//platform.ActivateApp()
	// 	a.SecondWindow.Show()
	// 	a.SecondWindow.Focus()
	// })
	a.MenuSetting = a.Menu.Add(lang.AppMenu.Preferences).OnClick(func(ctx *application.Context) {
		//platform.ActivateApp()
		a.Mainwindow.Show()
		a.Mainwindow.Focus()
	})
	a.Menu.AddSeparator()
	item := a.Menu.Add(lang.AppMenu.Version)
	item.SetEnabled(false)
	a.MenuVersion = item

	// 检查更新
	//a.Menu.AddSeparator()
	a.MenuUpdate = a.Menu.Add(lang.AppMenu.Update).OnClick(func(ctx *application.Context) {
		go func() {
			if err := a.CheckForUpdates(); err != nil {
				a.App.Logger.Error("update flow", "error", err)
			}
		}()
	})
	a.Menu.AddSeparator()
	a.MenuQuit = a.Menu.Add(lang.AppMenu.Quit).OnClick(func(ctx *application.Context) {
		a.App.Quit()
	})
	a.Tray.SetMenu(a.Menu)
}

// 更新托盘菜单
func UpdateAppMenu(a *AppService, langvalue string) {
	lang, langerr := LoadLang(a.I18nFS, langvalue)
	if langerr != nil {
		log.Fatal(langerr)
	}
	// a.MenuSecondBar.SetLabel(lang.AppMenu.Second)
	a.MenuSetting.SetLabel(lang.AppMenu.Preferences)
	a.MenuVersion.SetLabel(lang.AppMenu.Version)
	a.MenuUpdate.SetLabel(lang.AppMenu.Update)
	a.MenuQuit.SetLabel(lang.AppMenu.Quit)
	//a.Tray.SetMenu(menu)
	if runtime.GOOS == "darwin" {
		a.Menu.Update() // 刷新系统托盘菜单显示
	} else {
		a.Tray.SetMenu(a.Menu) // 重新设置菜单以刷新显示
	}
}

// 更新应用语言设置并刷新菜单显示
func (s *AppService) SetLanguage(lang string) error {
	current := s.Config.GetLanguage()
	if current == lang {
		return nil
	}
	// 2 更新菜单
	UpdateAppMenu(s, lang) // 更新菜单语言
	return s.Config.SetLanguage(lang)
}

const maxImageFileBytes = 12 * 1024 * 1024

var allowedImageExt = map[string]bool{

	".png":  true,
	".jpg":  true,
	".jpeg": true,
	".gif":  true,
	".webp": true,
	".bmp":  true,
}

// SelectAndUploadImages 选择图片并保存到本地 uploads 目录

func (a *AppService) SelectAndUploadImages() ([]string, error) {
	paths, err := a.App.Dialog.OpenFile().
		SetTitle("选择图片").
		AddFilter("Images", "*.png;*.jpg;*.jpeg;*.gif;*.webp;*.bmp").
		PromptForMultipleSelection()

	if err != nil {
		return nil, err
	}
	if len(paths) == 0 {
		return nil, nil
	}

	urls := make([]string, 0, len(paths))

	for _, path := range paths {
		file, err := os.Open(path)
		if err != nil {
			return nil, err
		}

		data, readErr := io.ReadAll(io.LimitReader(file, maxImageFileBytes+1))
		closeErr := file.Close()

		if readErr != nil {
			return nil, readErr
		}
		if closeErr != nil {
			return nil, closeErr
		}

		url, err := a.SaveImage(filepath.Base(path), data)
		if err != nil {
			return nil, err
		}

		urls = append(urls, url)
	}

	return urls, nil
}

func newImageFilename(ext string) (string, error) {

	randomBytes := make([]byte, 12)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", err
	}
	return fmt.Sprintf(
		"%s_%s%s",
		time.Now().Format("20060102_150405"),
		hex.EncodeToString(randomBytes),
		ext,
	), nil

}

func (a *AppService) SaveImage(name string, data []byte) (string, error) {
	ext := strings.ToLower(filepath.Ext(name))
	if !allowedImageExt[ext] {
		return "", fmt.Errorf("不支持的图片格式: %s", ext)
	}

	if len(data) == 0 {
		return "", fmt.Errorf("图片内容为空")
	}
	if len(data) > maxImageFileBytes {
		return "", fmt.Errorf("图片超过 12MB: %s", filepath.Base(name))
	}

	if err := os.MkdirAll(a.UploadDir, 0755); err != nil {
		return "", fmt.Errorf("创建图片目录失败: %w", err)
	}

	filename, err := newImageFilename(ext)
	if err != nil {
		return "", err
	}

	dst := filepath.Join(a.UploadDir, filename)

	if err := os.WriteFile(dst, data, 0644); err != nil {
		return "", err
	}

	return "/uploads/" + filename, nil
}

// CheckForUpdates checks for updates using the application's updater and installs them if available.
func (a *AppService) CheckForUpdates() error {
	return a.App.Updater.CheckAndInstall(context.Background())
}
