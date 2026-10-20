"""Discovery and URL registration for optional Django modules."""

import re
from pathlib import Path
from dataclasses import dataclass
from importlib import import_module
from importlib.util import find_spec

_MODULE_NAME = re.compile(r"^[a-z][a-z0-9_]*$")
_MODULE_DIR = Path(__file__).resolve().parent


@dataclass(frozen=True)
class EnabledModule:
    name: str
    app_config: str
    url_prefix: str
    urlconf: str
    urlpatterns: object | None


def get_enabled_modules(names=None):
    """Return enabled modules, rejecting misspelled or unavailable names."""
    if names is None:
        from django.conf import settings

        names = getattr(settings, "DEFAULT_ENABLED_MODULES", ())
        if names and isinstance(names[0], EnabledModule):
            return tuple(names)

    modules = []
    for name in names:
        if not _MODULE_NAME.fullmatch(name):
            raise ValueError(f"Invalid module name {name!r}.")

        package = f"modules.{name}"
        if find_spec(package) is None:
            raise ValueError(
                f"Module {name!r} is enabled but no {package!r} package exists."
            )

        config_module = import_module(f"{package}.apps")
        configs = [
            value
            for value in vars(config_module).values()
            if isinstance(value, type)
            and value.__module__ == config_module.__name__
            and value.__name__.endswith("Config")
        ]
        if len(configs) != 1:
            raise ValueError(
                f"Module {name!r} must define exactly one AppConfig class in apps.py."
            )

        config = configs[0]
        app_config = f"{config.__module__}.{config.__name__}"
        urlconf = getattr(config, "urlconf", f"{package}.urls")
        has_urls = find_spec(urlconf) is not None
        prefix = getattr(config, "url_prefix", name.strip("/") + "/").strip("/")
        modules.append(
            EnabledModule(
                name=name,
                app_config=app_config,
                url_prefix=f"{prefix}/" if prefix else "",
                urlconf=urlconf,
                urlpatterns=[] if has_urls else None,
            )
        )

    return tuple(modules)


def get_available_modules():
    """Return all discoverable module packages, whether currently enabled or not."""
    names = sorted(
        child.name for child in _MODULE_DIR.iterdir()
        if child.is_dir() and _MODULE_NAME.fullmatch(child.name)
        and (child / "apps.py").is_file()
    )
    return get_enabled_modules(names)
