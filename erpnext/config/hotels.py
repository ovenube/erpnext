from __future__ import unicode_literals
from frappe import _

def get_data():
	return [
        {
            "label": _("Reservation"),
            "items": [
                {
                    "type": "doctype",
                    "name": "Hotel Room Reservation",
                    "onboard": 1,
                }
            ]
        },
         {
            "label": _("Settings"),
            "items": [
                {
                    "type": "doctype",
                    "name": "Hotel Settings",
                },
                {
                    "type": "doctype",
                    "name": "Hotel Room Pricing",
                },
                {
                    "type": "doctype",
                    "name": "Hotel Room",
                },
                {
                    "type": "doctype",
                    "name": "Hotel Room Reservation",
                },
            ]
        }
    ]