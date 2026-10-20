"""Discovery and URL registration for optional Django extensions."""

import re
from dataclasses import dataclass
from importlib import import_module
from importlib.util import find_spec

_EXTENSION_NAME = re.compile(r"^[a-z][a-z0-9_]*$")


@dataclass(frozen=True)
class EnabledExtension:
    name: str
    app_config: str
    url_prefix: str
    urlconf: str
    urlpatterns: object | None


def get_enabled_extensions(names=None):
    """Return enabled extensions, rejecting misspelled or unavailable names."""
    if names is None:
        from django.conf import settings

        names = getattr(settings, "ENABLED_EXTENSIONS", ())

    extensions = []
    for name in names:
        if not _EXTENSION_NAME.fullmatch(name):
            raise ValueError(f"Invalid extension name {name!r}.")

        package = f"extensions.{name}"
        if find_spec(package) is None:
            raise ValueError(
                f"Extension {name!r} is enabled but no {package!r} package exists."
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
                f"Extension {name!r} must define exactly one AppConfig class in apps.py."
            )

        config = configs[0]
        app_config = f"{config.__module__}.{config.__name__}"
        urlconf = getattr(config, "urlconf", f"{package}.urls")
        has_urls = find_spec(urlconf) is not None
        prefix = getattr(config, "url_prefix", name.strip("/") + "/").strip("/")
        extensions.append(
            EnabledExtension(
                name=name,
                app_config=app_config,
                url_prefix=f"{prefix}/" if prefix else "",
                urlconf=urlconf,
                urlpatterns=[] if has_urls else None,
            )
        )

    return tuple(extensions)
