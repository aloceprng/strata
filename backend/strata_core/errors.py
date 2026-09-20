class StrataError(Exception):
    '''Base for every error raised by the token pipeline.'''


class TokenFileError(StrataError):
    '''The token document is not shaped like a DTCG file.'''


class UnknownReferenceError(StrataError):
    '''A token references a path that does not exist in the document.'''

    def __init__(self, source: str, target: str):
        self.source = source
        self.target = target
        super().__init__(f"{source} references {{{target}}}, which does not exist")


class CycleError(StrataError):
    '''A reference chain returns to where it started.'''

    def __init__(self, path: list[str]):
        self.path = path
        super().__init__("reference cycle: " + " -> ".join(path))


class LayerViolationError(StrataError):
    '''A primitive reaches upward into the semantic layer.'''

    def __init__(self, source: str, target: str):
        self.source = source
        self.target = target
        super().__init__(
            f"{source} (primitive) references {{{target}}} — primitives may not "
            f"depend on higher layers"
        )
