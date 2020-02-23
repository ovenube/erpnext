# -*- coding: utf-8 -*-
# Copyright (c) 2017, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe, re
from frappe.model.document import Document
from frappe.model.naming import make_autoname
from frappe import _

class RestaurantTable(Document):
	def autoname(self):
		prefix = _("Table")
		self.name = make_autoname(prefix + ' .##')
