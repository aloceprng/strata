class StrataError(Exception):
    pass

class TokenFileError(StrataError):
    pass

class UnknownReferenceError(StrataError):

    def __init__(self, source: str, target: str):
        self.source = source
        self.target = target
        super().__init__(f"{source} references {{{target}}}, which does not exist")

class CycleError(StrataError):

    def __init__(self, path: list[str]):
        self.path = path
        super().__init__("reference cycle: " + " -> ".join(path))

class LayerViolationError(StrataError):

    def __init__(self, source: str, target: str):
        self.source = source
        self.target = target
        super().__init__(
            f"{source} (primitive) references {{{target}}} — primitives may not "
            f"depend on higher layers"
        )
