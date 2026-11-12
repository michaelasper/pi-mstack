# Your first Pi session

You will install pi-mstack and switch Poteto Mode on and off in one session. By the end, you will have seen the extension's diagnostic report and branch-local mode state without sending a model request.

## Before you start

Use a POSIX shell with npm, Node.js 22.19 or later, and Pi 1.5.0 already installed. This exercise assumes you do not have another pstack port enabled. Resolve any resource collisions using the [installation guide](../how-to/install.md) before continuing.

## 1. Install from npm

In your terminal, run:

```sh
pi install npm:@trevonistrevon/pi-loop@0.7.19
pi install npm:pi-subagents@0.87.0
pi install npm:pi-mstack
```

These commands register the three npm packages in Pi’s user configuration. You do not need a source checkout.

## 2. Start Pi and inspect the extension

```sh
pi
```

Enter:

```text
/pstack doctor
```

The report includes mode state, role configuration, resource collisions, and observable dependency tools. With no saved default, a fresh session starts with mode off. Missing role configuration inherits the current parent model. An unavailable model is reported as blocked, not silently replaced.

If a collision is reported, stop here and resolve it before proceeding.

## 3. Enable mode

Enter:

```text
/poteto-mode
/pstack doctor
```

You should see confirmation that Poteto Mode is enabled. Doctor now reports it as on. This command changes session state without inference.

## 4. Disable mode

Enter:

```text
/poteto-mode off
/pstack doctor
```

Mode is now off. Role configuration remains available independently of mode.

You have installed the port and exercised its state controls. To start real work, use `/skill:poteto-mode <task>` while Pi is idle. That route sends a model request and may incur provider charges. Continue with [choosing role models](../how-to/configure-models.md) before relying on a review panel.
