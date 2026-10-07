import copy

import pytest

from strata_core import classify_diff, diff_documents

@pytest.fixture
def v1():
    return {
        "primitive": {
            "colour": {"$type": "color",
                       "green": {"600": {"$value": "#2f7a3f"}, "700": {"$value": "#245f31"}}},
            "radius": {"$type": "dimension", "md": {"$value": "4px"}},
        },
        "semantic": {
            "colour": {"$type": "color", "action": {
                "bg": {"$value": "{primitive.colour.green.600}"},
                "border": {"$value": "{semantic.colour.action.bg}"},
            }},
            "radius": {"control": {"$type": "dimension", "$value": "{primitive.radius.md}"}},
        },
        "component": {"button": {"size": {"$type": "string", "$value": "md"}}},
    }

def report_for(v1, v2):
    return classify_diff(diff_documents(v1, v2))

def severity_of(report, path):
    return next(item.severity for item in report.items if item.path == path)

class TestTheRules:
    def test_a_value_change_is_a_patch(self, v1):
        v2 = copy.deepcopy(v1)
        v2["semantic"]["radius"]["control"]["$value"] = "8px"
        assert severity_of(report_for(v1, v2), "semantic.radius.control") == "patch"

    def test_an_addition_is_minor(self, v1):
        v2 = copy.deepcopy(v1)
        v2["semantic"]["colour"]["warning"] = {"bg": {"$value": "#f5c542"}}
        assert severity_of(report_for(v1, v2), "semantic.colour.warning.bg") == "minor"

    def test_removing_a_semantic_token_is_major(self, v1):
        v2 = copy.deepcopy(v1)
        del v2["semantic"]["colour"]["action"]["border"]
        assert severity_of(report_for(v1, v2), "semantic.colour.action.border") == "major"

    def test_removing_a_component_default_is_major(self, v1):
        v2 = copy.deepcopy(v1)
        del v2["component"]
        assert severity_of(report_for(v1, v2), "component.button.size") == "major"

    def test_removing_a_primitive_is_minor(self, v1):
        v2 = copy.deepcopy(v1)
        del v2["primitive"]["colour"]["green"]["700"]
        assert severity_of(report_for(v1, v2), "primitive.colour.green.700") == "minor"

    def test_a_rename_is_major(self, v1):
        v2 = copy.deepcopy(v1)
        action = v2["semantic"]["colour"]["action"]
        action["outline"] = action.pop("border")
        report = report_for(v1, v2)
        assert severity_of(report, "semantic.colour.action.border") == "major"
        assert severity_of(report, "semantic.colour.action.outline") == "minor"
        assert report.severity == "major"

    def test_a_type_change_is_major(self, v1):
        v2 = copy.deepcopy(v1)
        v2["semantic"]["radius"]["control"] = {"$type": "string", "$value": "round"}
        item = next(i for i in report_for(v1, v2).items if i.path == "semantic.radius.control")
        assert item.severity == "major"
        assert "dimension to string" in item.reason

    def test_a_moved_alias_with_the_same_output_is_a_patch(self, v1):
        v2 = copy.deepcopy(v1)
        v2["primitive"]["colour"]["green"]["650"] = {"$value": "#2f7a3f"}
        v2["semantic"]["colour"]["action"]["bg"]["$value"] = "{primitive.colour.green.650}"
        item = next(i for i in report_for(v1, v2).items if i.path == "semantic.colour.action.bg")
        assert item.severity == "patch"
        assert "no visible change" in item.reason

class TestCascades:
    def test_one_edit_is_grouped_with_everything_it_caused(self, v1):
        v2 = copy.deepcopy(v1)
        v2["primitive"]["colour"]["green"]["600"]["$value"] = "#1f5a2c"
        report = report_for(v1, v2)
        caused = [item.path for item in report.by_source["primitive.colour.green.600"]]
        assert caused == ["semantic.colour.action.bg", "semantic.colour.action.border"]
        assert all(item.severity == "patch" for item in report.items)

    def test_a_cascade_reason_names_its_source(self, v1):
        v2 = copy.deepcopy(v1)
        v2["primitive"]["colour"]["green"]["600"]["$value"] = "#1f5a2c"
        item = next(i for i in report_for(v1, v2).items
                    if i.path == "semantic.colour.action.border")
        assert "primitive.colour.green.600" in item.reason

class TestTheRelease:
    def test_the_release_takes_its_worst_change(self, v1):
        v2 = copy.deepcopy(v1)
        v2["semantic"]["radius"]["control"]["$value"] = "8px"
        v2["semantic"]["colour"]["warning"] = {"bg": {"$value": "#f5c542"}}
        report = report_for(v1, v2)
        assert report.severity == "minor"
        assert report.counts() == {"major": 0, "minor": 1, "patch": 1}

    def test_no_changes_means_no_severity(self, v1):
        assert report_for(v1, copy.deepcopy(v1)).severity is None
