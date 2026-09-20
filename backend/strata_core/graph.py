from __future__ import annotations

from .errors import CycleError, LayerViolationError, UnknownReferenceError
from .parse import Token

LAYER_RANK = {"primitive": 0, "semantic": 1, "component": 2}
WHITE, GREY, BLACK = 0, 1, 2


def dependencies(tokens: dict[str, Token]) -> dict[str, list[str]]:
    '''Each token's references, order preserved.'''

    deps: dict[str, list[str]] = {}
    for path, token in tokens.items():
        seen: list[str] = []
        for ref in token.refs:
            if ref not in tokens:
                raise UnknownReferenceError(path, ref)
            if ref not in seen:
                seen.append(ref)
        deps[path] = seen
    return deps


def check_layering(tokens: dict[str, Token], deps: dict[str, list[str]]) -> None:
    '''A token may depend on its own layer or a lower one, never a higher one.'''

    for path, refs in deps.items():
        rank = LAYER_RANK.get(tokens[path].layer)
        if rank is None:
            continue
        for ref in refs:
            ref_rank = LAYER_RANK.get(tokens[ref].layer)
            if ref_rank is not None and ref_rank > rank:
                raise LayerViolationError(path, ref)


def detect_cycles(deps: dict[str, list[str]]) -> None:
    '''DFS with colour marking.'''

    colour = dict.fromkeys(deps, WHITE)

    for start in sorted(deps):
        if colour[start] != WHITE:
            continue

        colour[start] = GREY
        path = [start]
        stack = [(start, iter(deps[start]))]

        while stack:
            node, remaining = stack[-1]
            descended = False

            for dep in remaining:
                if colour[dep] == GREY:
                    closed = path[path.index(dep):] + [dep]
                    raise CycleError(closed)
                if colour[dep] == WHITE:
                    colour[dep] = GREY
                    path.append(dep)
                    stack.append((dep, iter(deps[dep])))
                    descended = True
                    break

            if not descended:
                colour[node] = BLACK
                stack.pop()
                path.pop()


def topological_order(deps: dict[str, list[str]]) -> list[str]:
    '''Kahn's algorithm, alphabetical among ties so builds are reproducible.'''

    dependents: dict[str, list[str]] = {path: [] for path in deps}
    indegree = {path: len(refs) for path, refs in deps.items()}

    for path, refs in deps.items():
        for ref in refs:
            dependents[ref].append(path)

    ready = sorted(path for path, n in indegree.items() if n == 0)
    order: list[str] = []

    while ready:
        path = ready.pop(0)
        order.append(path)
        newly_ready = []
        for dependent in dependents[path]:
            indegree[dependent] -= 1
            if indegree[dependent] == 0:
                newly_ready.append(dependent)
        if newly_ready:
            ready = sorted(ready + newly_ready)

    if len(order) != len(deps):
        stuck = sorted(set(deps) - set(order))
        raise CycleError(stuck[:8])

    return order
