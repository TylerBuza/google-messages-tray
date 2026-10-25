$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
public static class TrayChromeWindow {
  public delegate bool EnumProc(IntPtr hwnd, IntPtr param);
  private delegate IntPtr MouseProc(int code, IntPtr message, IntPtr data);
  [StructLayout(LayoutKind.Sequential)] public struct Point { public int x, y; }
  [StructLayout(LayoutKind.Sequential)] private struct Rect { public int left, top, right, bottom; }
  [StructLayout(LayoutKind.Sequential)] private struct MouseData { public Point point; public uint data, flags, time; public UIntPtr extra; }
  [StructLayout(LayoutKind.Sequential)] private struct Message { public IntPtr hwnd; public uint message; public UIntPtr wParam; public IntPtr lParam; public uint time; public Point point; public uint reserved; }
  [DllImport("user32.dll")] private static extern bool EnumWindows(EnumProc callback, IntPtr param);
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
  [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr hwnd, int command);
  [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr hwnd);
  [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] private static extern IntPtr GetSystemMenu(IntPtr hwnd, bool revert);
  [DllImport("user32.dll")] private static extern bool DrawMenuBar(IntPtr hwnd);
  [DllImport("user32.dll")] private static extern IntPtr WindowFromPoint(Point point);
  [DllImport("user32.dll")] private static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);
  [DllImport("user32.dll")] private static extern IntPtr SendMessageTimeout(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam, uint flags, uint timeout, out UIntPtr result);
  [DllImport("user32.dll")] private static extern IntPtr SetWindowsHookEx(int kind, MouseProc callback, IntPtr module, uint thread);
  [DllImport("user32.dll")] private static extern bool UnhookWindowsHookEx(IntPtr hook);
  [DllImport("user32.dll")] private static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr message, IntPtr data);
  [DllImport("user32.dll")] private static extern int GetMessage(out Message message, IntPtr hwnd, uint min, uint max);
  [DllImport("user32.dll")] private static extern bool TranslateMessage(ref Message message);
  [DllImport("user32.dll")] private static extern IntPtr DispatchMessage(ref Message message);
  [DllImport("user32.dll")] private static extern bool PostThreadMessage(uint thread, uint message, UIntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
  [DllImport("user32.dll")] private static extern uint GetDpiForWindow(IntPtr hwnd);
  [DllImport("dwmapi.dll")] private static extern int DwmGetWindowAttribute(IntPtr hwnd, uint attribute, out Rect rect, int size);
  [DllImport("user32.dll")] private static extern bool SetProcessDpiAwarenessContext(IntPtr context);
  [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] private static extern IntPtr GetModuleHandle(string name);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int GetClassName(IntPtr hwnd, System.Text.StringBuilder name, int size);
  private static uint ownerId, loopThread;
  private static IntPtr hook;
  private static MouseProc mouseCallback = OnMouse;
  private static bool swallowRelease;
  [ThreadStatic] private static IntPtr syntheticWindow;
  private static bool OwnWindow(IntPtr hwnd) {
    uint owner; GetWindowThreadProcessId(hwnd, out owner);
    if (owner != ownerId) return false;
    var name = new System.Text.StringBuilder(256); GetClassName(hwnd, name, 256);
    return name.ToString() == "Chrome_WidgetWin_1";
  }
  private static int HitTest(IntPtr hwnd, Point point) {
    UIntPtr result;
    long packed = (long)(ushort)point.x | ((long)(ushort)point.y << 16);
    if (SendMessageTimeout(hwnd, 0x84, IntPtr.Zero, new IntPtr(packed), 2, 50, out result) == IntPtr.Zero) return 0;
    return unchecked((int)result.ToUInt64());
  }
  private static bool HideCloseAt(Point point) {
    var root = syntheticWindow != IntPtr.Zero ? syntheticWindow : GetAncestor(WindowFromPoint(point), 2);
    if (root == IntPtr.Zero || !OwnWindow(root) || !IsClosePoint(root, point)) return false;
    ShowWindow(root, 0); return true;
  }
  private static bool IsClosePoint(IntPtr hwnd, Point point) {
    if (HitTest(hwnd, point) == 20) return true;
    // Chrome can draw caption controls itself and return HTCLIENT. Ask DWM
    // for the native caption-button rectangle rather than guessing screen pixels.
    Rect buttons, window;
    if (DwmGetWindowAttribute(hwnd, 5, out buttons, Marshal.SizeOf(typeof(Rect))) != 0 || !GetWindowRect(hwnd, out window)) return false;
    if (buttons.right <= buttons.left || buttons.bottom <= buttons.top) return false;
    int x = point.x - window.left, y = point.y - window.top;
    int closeLeft = buttons.right - (buttons.right - buttons.left) / 3;
    return x >= closeLeft && x < buttons.right && y >= buttons.top && y < buttons.bottom;
  }
  private static IntPtr OnMouse(int code, IntPtr message, IntPtr data) {
    if (code >= 0) {
      // Observe no movement/text, retain no input. Only swallow our own Chrome's X.
      if (message.ToInt64() == 0x201) {
        var mouse = (MouseData)Marshal.PtrToStructure(data, typeof(MouseData));
        if (HideCloseAt(mouse.point)) { swallowRelease = true; return new IntPtr(1); }
      }
      if (message.ToInt64() == 0x202 && swallowRelease) { swallowRelease = false; return new IntPtr(1); }
    }
    return CallNextHookEx(hook, code, message, data);
  }
  private static void Handle(string command) {
    int count = 0, visible = 0; bool closeHandled = false;
    EnumWindows(delegate(IntPtr hwnd, IntPtr unused) {
      if (!OwnWindow(hwnd)) return true;
      count++;
      if (command == "hide") ShowWindow(hwnd, 0);
      if (command == "show") {
        GetSystemMenu(hwnd, true); DrawMenuBar(hwnd);
        ShowWindow(hwnd, 9); SetForegroundWindow(hwnd);
      }
      if (command == "test-close" && IsWindowVisible(hwnd)) {
        // Probe the native X hit area and run the exact hook callback; no mouse
        // movement/click is injected into the user's desktop during a smoke test.
        Rect rect; GetWindowRect(hwnd, out rect);
        double scale = Math.Max(1, GetDpiForWindow(hwnd) / 96.0);
        for (int y = 8; y <= 48 && !closeHandled; y += 4) {
          for (int x = 8; x <= 70 && !closeHandled; x += 4) {
            var point = new Point { x = rect.right - (int)(x * scale), y = rect.top + (int)(y * scale) };
            if (!IsClosePoint(hwnd, point)) continue;
            var data = new MouseData { point = point };
            var memory = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(MouseData)));
            try {
              Marshal.StructureToPtr(data, memory, false);
              // A synthetic click has no OS window-under-cursor. Supply the HWND
              // on this test thread only, so another foreground app cannot make
              // the test flaky. Real hook callbacks always use WindowFromPoint.
              syntheticWindow = hwnd;
              closeHandled = OnMouse(0, new IntPtr(0x201), memory) != IntPtr.Zero;
              OnMouse(0, new IntPtr(0x202), memory);
            } finally { syntheticWindow = IntPtr.Zero; Marshal.FreeHGlobal(memory); }
          }
        }
      }
      if (IsWindowVisible(hwnd)) visible++;
      return true;
    }, IntPtr.Zero);
    Console.WriteLine("{\"ok\":true,\"count\":" + count + ",\"visible\":" + visible + ",\"closeHandled\":" + (closeHandled ? "true" : "false") + ",\"hookActive\":" + (hook != IntPtr.Zero ? "true" : "false") + "}");
  }
  public static void Run(uint processId) {
    ownerId = processId; SetProcessDpiAwarenessContext(new IntPtr(-4));
    loopThread = GetCurrentThreadId();
    hook = SetWindowsHookEx(14, mouseCallback, GetModuleHandle(null), 0);
    if (hook == IntPtr.Zero) throw new Exception("Could not enable X-to-tray mouse handling");
    var reader = new Thread(delegate() {
      string command;
      while ((command = Console.ReadLine()) != null) {
        try { Handle(command); } catch { Console.WriteLine("{\"ok\":false}"); }
      }
      PostThreadMessage(loopThread, 0x12, UIntPtr.Zero, IntPtr.Zero);
    });
    reader.IsBackground = true; reader.Start();
    try { Message message; while (GetMessage(out message, IntPtr.Zero, 0, 0) > 0) { TranslateMessage(ref message); DispatchMessage(ref message); } }
    finally { UnhookWindowsHookEx(hook); hook = IntPtr.Zero; }
  }
}
'@
[TrayChromeWindow]::Run(__OWNER_PID__)
