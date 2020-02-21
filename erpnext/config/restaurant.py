from __future__ import unicode_literals
from frappe import _

def get_data():
	return [
        {
            "label": _("Orders and Reservation"),
            "items": [
                {
                    "type": "doctype",
                    "name": "Restaurant Order Entry",
                    "onboard": 1,
                },
                 {
                    "type": "doctype",
                    "name": "Restaurant Reservation",
                    "onboard": 1,
                },
            ]
        },
        {
            "label": _("Settings"),
            "items": [
                {
                    "type": "doctype",
                    "name": "Restaurant",
                    "onboard": 1,
                },
                {
                    "type": "doctype",
                    "name": "Restaurant Floor",
                },
                {
                    "type": "doctype",
                    "name": "Restaurant Table",
                },
                {
                    "type": "doctype",
                    "name": "Restaurant Menu",
                },
            ]
        },
        {
            "label": _("POS"),
            "items": [
                {
                    "type": "page",
                    "name": "table-board",
                    "label": _("Table Board"),
					"icon": "fa fa-bar-chart",
					"onboard": 1,
                }
            ]
        },
    ]