/* global Clusterize */
frappe.provide('erpnext.restaurant_pos');

frappe.pages['restaurant-pos'].on_page_load = function(wrapper) {
	var table = window.location.hash.split("/")[1];
	if (table == "delivery"){
		if (window.location.hash.split('/').length == 3){
			var restaurant_order = window.location.hash.split("/")[2];
		} else {
			var restaurant_order = "";
		}		
	} else {
		var restaurant_order = "";
	}
	frappe.ui.make_app_page({
		parent: wrapper,
		title: __('Restaurant POS'),
		single_column: true
	});

	frappe.db.get_value('POS Settings', {name: 'POS Settings'}, 'is_online', (r) => {
		if (r && !cint(r.use_pos_in_offline_mode)) {
			// online
			wrapper.pos = new erpnext.restaurant_pos.PointOfSale(wrapper, table, restaurant_order);
			window.cur_pos = wrapper.pos;
		} else {
			// offline
			frappe.flags.is_offline = true;
			frappe.set_route('pos');
		}
	});
};

frappe.pages['restaurant-pos'].refresh = function(wrapper) {
	if (wrapper.pos) {
		wrapper.pos.make_new_invoice();
	}

	if (frappe.flags.is_offline) {
		frappe.set_route('pos');
	}
}

erpnext.restaurant_pos.PointOfSale = class PointOfSale {
	constructor(wrapper, table, restaurant_order="") {
		this.wrapper = $(wrapper).find('.layout-main-section');
		this.page = wrapper.page;

		const assets = [
			'assets/erpnext/js/pos/clusterize.js',
			'assets/erpnext/css/pos.css'
		];

		frappe.require(assets, () => {
			this.make(table, restaurant_order);	
		});
	}

	make(table, restaurant_order) {
		return frappe.run_serially([
			() => frappe.dom.freeze(),
			() => {
				this.prepare_dom(table);
				this.prepare_menu();
				this.set_online_status();
			},
			() => this.make_new_invoice(),
			() => {
				if(!this.frm.doc.company) {
					this.setup_company()
						.then((company) => {
							this.frm.doc.company = company;
							this.get_pos_profile();
						});
				}
			},
			() => {
				frappe.dom.unfreeze();
			},
			() => this.page.set_title(__('Restaurant POS')),
			() => this.get_order_customer(table, restaurant_order),
			() => this.prepare_actions()
		]);
	}

	get_order_customer(table, restaurant_order="") {
		var doctype = "Restaurant Order";
		if (restaurant_order != ""){
			this.frm.set_value("restaurant_order", restaurant_order);
			this.frm.refresh_field('restaurant_order');
			frappe.db.get_doc(doctype, restaurant_order).then((order) => {
				this.cart.customer_field.set_value(order.customer);		
			})
		} else {
			if (table == "delivery"){
				frappe.db.insert({
					doctype: doctype,
					order_status: 'Taken',
					waiter: frappe.user_info().name,
					time: frappe.datetime.now_time()
				}).then((order) => {
					this.frm.set_value("restaurant_order", order.name);
					this.frm.refresh_field('restaurant_order');
				})				
			} else {
				var table = table.replace("%20", " ");
				frappe.db.get_doc("Restaurant Table", table).then((result_table) => {
					if (result_table){
						this.frm.doc.restaurant = result_table.restaurant;
						this.frm.doc.restaurant_table = result_table.name;
						frappe.db.get_list(doctype, {filters: {"restaurant_table": result_table.name, "order_status": ['in', ["Taken", "In progress", "Precount", "Attended"]]}}).then((result) => {
							if (result.length == 1) {
								frappe.db.get_doc(doctype, result[0].name).then((order) => {
									this.cart.customer_field.set_value(order.customer);
									this.frm.set_value("restaurant_order", order.name);
									this.frm.refresh_field('restaurant_order');
								})
							} else {
								frappe.xcall("erpnext.restaurant.page.restaurant_pos.restaurant_pos.update_table", 
									{'restaurant_table': table, 'occupied': 1}).then((r) => {
									frappe.db.insert({
										doctype: doctype,
										restaurant_table: table,
										order_status: 'Taken',
										waiter: frappe.user_info().name
									}).then((order) => {
										this.frm.set_value("restaurant_order", order.name);
										this.frm.refresh_field('restaurant_order');
									})
								})
							}
						})
					}
				})
			}
		}
	}

	get_pos_profile() {
		return frappe.xcall("erpnext.stock.get_item_details.get_pos_profile",
			{'company': this.frm.doc.company})
			.then((r) => {
				if(r) {
					this.frm.doc.pos_profile = r.name;
					this.set_pos_profile_data()
						.then(() => {
							this.on_change_pos_profile();
						});
				} else {
					this.raise_exception_for_pos_profile();
				}
		});
	}

	set_online_status() {
		this.connection_status = false;
		this.page.set_indicator(__("Offline"), "grey");
		frappe.call({
			method: "frappe.handler.ping",
			callback: r => {
				if (r.message) {
					this.connection_status = true;
					this.page.set_indicator(__("Online"), "green");
				}
			}
		});
	}

	raise_exception_for_pos_profile() {
		setTimeout(() => frappe.set_route('List', 'POS Profile'), 2000);
		frappe.throw(__("POS Profile is required to use Point-of-Sale"));
	}

	prepare_dom(table) {
		this.wrapper.append(`
			<div class="container">
				<div class="row justify-content-center">
					<h1 class="text-center" id="table-title">` + table.replace("%20", " ").toUpperCase() + `</h1>
				</div>
			</div>
			<div class="pos">
				<section class="cart-container">

				</section>
				<section class="item-container">

				</section>
			</div>
		`);
	}

	make_cart() {
		this.cart = new POSCart({
			frm: this.frm,
			wrapper: this.wrapper.find('.cart-container'),
			events: {
				on_customer_change: (customer) => {
					this.frm.set_value('customer', customer);
					if (this.frm.doc.codigo_tipo_documento != "" && this.frm.doc.customer != ""){
						var doctype = "Restaurant Order";
						if (this.frm.doc.restaurant_order != undefined){
							frappe.db.get_doc(doctype, this.frm.doc.restaurant_order).then((order) => {
								frappe.xcall('erpnext.restaurant.page.restaurant_pos.restaurant_pos.update_order_customer', 
									{"order": this.frm.doc.restaurant_order, "customer": this.frm.doc.customer}).then((r) => {
									order.items.forEach(order_item => {
										var item = this.frm.add_child('items', { item_code: order_item.item });
										item['qty'] = 1;
										item['observations'] = order_item['observations'];
										this.get_items_from_order(item, order_item);
									})
								})
							})
						} else {
							frappe.db.get_list(doctype, {filters: {"restaurant_table": this.frm.doc.restaurant_table, "order_status": ['in', ["Taken", "In progress", "Precount", "Attended"]]}}).then((result) => {
								if (result.length == 1) {
									frappe.db.get_doc(doctype, result[0].name).then((order) => {
									frappe.xcall('erpnext.restaurant.page.restaurant_pos.restaurant_pos.update_order_customer', 
										{"order": this.frm.doc.restaurant_order, "customer": this.frm.doc.customer}).then((r) => {
											order.items.forEach(order_item => {
												var item = this.frm.add_child('items', { item_code: order_item.item });
												item['qty'] = 1;
												item['observations'] = order_item['observations'];
												this.get_items_from_order(item, order_item);
											})
										})
									})
								}
							})
						}
					}
				},
				on_field_change: (item_code, field, value, batch_no) => {
					this.update_item_in_cart(item_code, field, value, batch_no);
				},
				on_numpad: (value) => {
					if (value == __('Pay')) {
						if (!this.payment) {
							this.make_payment_modal();
						} else {
							this.frm.doc.payments.map(p => {
								this.payment.dialog.set_value(p.mode_of_payment, p.amount);
							});

							this.payment.set_title();
						}
						this.payment.open_modal();
					}
				},
				on_select_change: () => {
					this.cart.numpad.set_inactive();
					this.set_form_action();
				},
				get_item_details: (item_code) => {
					return this.items.get(item_code);
				},
				get_loyalty_details: () => {
					var me = this;
					if (this.frm.doc.customer) {
						frappe.call({
							method: "erpnext.accounts.doctype.loyalty_program.loyalty_program.get_loyalty_program_details",
							args: {
								"customer": me.frm.doc.customer,
								"expiry_date": me.frm.doc.posting_date,
								"company": me.frm.doc.company,
								"silent": true
							},
							callback: function(r) {
								if (r.message.loyalty_program && r.message.loyalty_points) {
									me.cart.events.set_loyalty_details(r.message, true);
								}
								if (!r.message.loyalty_program) {
									var loyalty_details = {
										loyalty_points: 0,
										loyalty_program: '',
										expense_account: '',
										cost_center: ''
									}
									me.cart.events.set_loyalty_details(loyalty_details, false);
								}
							}
						});
					}
				},
				set_loyalty_details: (details, view_status) => {
					if (view_status) {
						this.cart.available_loyalty_points.$wrapper.removeClass("hide");
					} else {
						this.cart.available_loyalty_points.$wrapper.addClass("hide");
					}
					this.cart.available_loyalty_points.set_value(details.loyalty_points);
					this.cart.available_loyalty_points.refresh_input();
					this.frm.set_value("loyalty_program", details.loyalty_program);
					this.frm.set_value("loyalty_redemption_account", details.expense_account);
					this.frm.set_value("loyalty_redemption_cost_center", details.cost_center);
				}
			}
		});

		frappe.ui.form.on('Sales Invoice', 'selling_price_list', (frm) => {
			if(this.items && frm.doc.pos_profile) {
				this.items.reset_items();
			}
		})
	}

	get_items_from_order(item, order_item){
		frappe.flags.hide_serial_batch_dialog = true;
		frappe.run_serially([
			() => {
				frappe.model.set_value(item.doctype, item.name, 'qty', order_item.qty).then(() => {
					for (var i=0; i < order_item.qty; i++){
						frappe.run_serially([
							() => {
								this.frm.script_manager.trigger('item_code', item.doctype, item.name)
									.then(() => {
										this.frm.script_manager.trigger('qty', item.doctype, item.name)
											.then(() => {
												frappe.run_serially([
													() => {
														let items = this.frm.doc.items.map(i => i.name);
														if (items && items.length > 0 && items.includes(item.name)) {
															this.frm.doc.items.forEach(item_row => {
																// update cart
																this.on_qty_change(item_row);
															});
														} else {
															this.on_qty_change(item);
														}
													},
													() => this.post_qty_change(item)
												]);
											});
									});
							},
							() => {
								const show_dialog = item.has_serial_no || item.has_batch_no;
				
								// if actual_batch_qty and actual_qty if then there is only one batch. In such
								// a case, no point showing the dialog
								if (show_dialog && field == 'qty' && ((!item.batch_no && item.has_batch_no) ||
									(item.has_serial_no) || (item.actual_batch_qty != item.actual_qty)) ) {
									// check has serial no/batch no and update cart
									this.select_batch_and_serial_no(item);
								}
							}
						]);
					}
				});
			}
		]);
	}

	toggle_editing(flag) {
		let disabled;
		if (flag !== undefined) {
			disabled = !flag;
		} else {
			disabled = this.frm.doc.docstatus == 1 ? true: false;
		}
		const pointer_events = disabled ? 'none' : 'inherit';

		this.wrapper.find('input, button, select').prop("disabled", disabled);
		this.wrapper.find('.number-pad-container').toggleClass("hide", disabled);

		this.wrapper.find('.cart-container').css('pointer-events', pointer_events);
		this.wrapper.find('.item-container').css('pointer-events', pointer_events);

		this.page.clear_actions();
	}

	make_items() {
		this.items = new POSItems({
			wrapper: this.wrapper.find('.item-container'),
			frm: this.frm,
			events: {
				update_cart: (item, field, value) => {
					if(!this.frm.doc.customer) {
						frappe.throw(__('Please select a customer'));
					}
					this.update_item_in_cart(item, field, value);
					this.cart && this.cart.unselect_all();
				}
			}
		});
	}

	update_item_in_cart(item_code, field='qty', value=1, batch_no) {
		frappe.dom.freeze();
		if(this.cart.exists(item_code, batch_no)) {
			const search_field = batch_no ? 'batch_no' : 'item_code';
			const search_value = batch_no || item_code;
			const item = this.frm.doc.items.find(i => i[search_field] === search_value);
			frappe.flags.hide_serial_batch_dialog = false;

			if (typeof value === 'string' && !in_list(['serial_no', 'batch_no'], field)) {
				// value can be of type '+1' or '-1'
				value = item[field] + flt(value);
			}

			if(field === 'serial_no') {
				value = item.serial_no + '\n'+ value;
			}

			// if actual_batch_qty and actual_qty if there is only one batch. In such
			// a case, no point showing the dialog
			const show_dialog = item.has_serial_no || item.has_batch_no;

			if (show_dialog && field == 'qty' && ((!item.batch_no && item.has_batch_no) ||
				(item.has_serial_no) || (item.actual_batch_qty != item.actual_qty)) ) {
				this.select_batch_and_serial_no(item);
			} else {
				this.update_item_in_frm(item, field, value)
					.then(() => {
						frappe.dom.unfreeze();
						frappe.run_serially([
							() => {
								let items = this.frm.doc.items.map(item => item.name);
								if (items && items.length > 0 && items.includes(item.name)) {
									this.frm.doc.items.forEach(item_row => {
										// update cart
										this.on_qty_change(item_row);
									});
								} else {
									this.on_qty_change(item);
								}
							},
							() => this.post_qty_change(item),
							() => {
								frappe.xcall('erpnext.restaurant.page.restaurant_pos.restaurant_pos.update_order_items', 
									{"order": this.frm.doc.restaurant_order, "items": this.frm.doc.items, "total_qty": this.frm.doc.total_qty}).then((r) => {})
							}
						]);
					});
			}
			return;
		}

		let args = { item_code: item_code };
		if (in_list(['serial_no', 'batch_no'], field)) {
			args[field] = value;
		}
		
		// add to cur_frm
		const item = this.frm.add_child('items', args);
		frappe.flags.hide_serial_batch_dialog = true;

		frappe.run_serially([
			() => {
				return this.frm.script_manager.trigger('item_code', item.doctype, item.name)
					.then(() => {
						this.frm.script_manager.trigger('qty', item.doctype, item.name)
							.then(() => {
								frappe.run_serially([
									() => {
										let items = this.frm.doc.items.map(i => i.name);
										if (items && items.length > 0 && items.includes(item.name)) {
											this.frm.doc.items.forEach(item_row => {
												// update cart
												this.on_qty_change(item_row);
											});
										} else {
											this.on_qty_change(item);
										}
									},
									() => this.post_qty_change(item)
								]);
							});
					});
			},
			() => {
				const show_dialog = item.has_serial_no || item.has_batch_no;

				// if actual_batch_qty and actual_qty if then there is only one batch. In such
				// a case, no point showing the dialog
				if (show_dialog && field == 'qty' && ((!item.batch_no && item.has_batch_no) ||
					(item.has_serial_no) || (item.actual_batch_qty != item.actual_qty)) ) {
					// check has serial no/batch no and update cart
					this.select_batch_and_serial_no(item);
				}
			},
			() => {
				frappe.xcall('erpnext.restaurant.page.restaurant_pos.restaurant_pos.update_order_items', 
					{"order": this.frm.doc.restaurant_order, "items": this.frm.doc.items}).then((r) => {})
			}
		]);
	}

	on_qty_change(item) {
		frappe.run_serially([
			() => this.update_cart_data(item),
		]);
	}

	post_qty_change(item) {
		this.cart.update_taxes_and_totals();
		this.cart.update_grand_total();
		this.cart.update_qty_total();
		this.cart.scroll_to_item(item.item_code);
		this.set_form_action();
	}

	select_batch_and_serial_no(row) {
		frappe.dom.unfreeze();

		erpnext.show_serial_batch_selector(this.frm, row, () => {
			this.frm.doc.items.forEach(item => {
				this.update_item_in_frm(item, 'qty', item.qty)
					.then(() => {
						// update cart
						frappe.run_serially([
							() => {
								if (item.qty === 0) {
									frappe.model.clear_doc(item.doctype, item.name);
								}
							},
							() => this.update_cart_data(item),
							() => this.post_qty_change(item)
						]);
					});
			})
		}, () => {
			this.on_close(row);
		}, true);
	}

	on_close(item) {
		if (!this.cart.exists(item.item_code, item.batch_no) && item.qty) {
			frappe.model.clear_doc(item.doctype, item.name);
		}
	}

	update_cart_data(item) {
		this.cart.add_item(item);
		frappe.dom.unfreeze();
	}

	update_item_in_frm(item, field, value) {
		if (field == 'qty' && value < 0) {
			frappe.msgprint(__("Quantity must be positive"));
			value = item.qty;
		} else {
			if (in_list(["qty", "serial_no", "batch"], field)) {
				item[field] = value;
				if (field == "serial_no" && value) {
					let serial_nos = value.split("\n");
					item["qty"] = serial_nos.filter(d => {
						return d!=="";
					}).length;
				}
			} else {
				return frappe.model.set_value(item.doctype, item.name, field, value);
			}
		}

		return this.frm.script_manager.trigger('qty', item.doctype, item.name)
			.then(() => {
				if (field === 'qty' && item.qty === 0) {
					frappe.model.clear_doc(item.doctype, item.name);
				}
			})

		return Promise.resolve();
	}

	make_payment_modal() {
		this.payment = new Payment({
			frm: this.frm,
			events: {
				submit_form: () => {
					this.submit_sales_invoice();
				}
			}
		});
	}

	submit_sales_invoice() {
		var me = this;
		this.frm.save().then(() => {
			frappe.xcall('erpnext.restaurant.page.restaurant_pos.restaurant_pos.generate_electronic_invoice', {
				'company': this.frm.doc.company,
				'invoice': this.frm.doc.name,
				'doctype': this.frm.doc.doctype
			}).then((r) => {
				
				if (r != "") {
					frappe.show_alert({
						indicator: 'green',
						message: __(`Sales invoice ${this.frm.doc.name} created succesfully`)
					});

					me.toggle_editing();
					me.set_form_action();
					me.set_primary_action_in_modal();
					window.open(r.enlace_del_pdf);		
					frappe.xcall("erpnext.restaurant.page.restaurant_pos.restaurant_pos.update_table", 
						{'restaurant_table': table, 'occupied': 0}).then((r) => {
							frappe.xcall("erpnext.restaurant.page.restaurant_pos.restaurant_pos.pay_restaurant_order",
							{'order': me.frm.doc.restaurant_order}).then((r) => {})
						})	
				}
			});
		})
	}

	set_primary_action_in_modal() {
		if (!this.frm.msgbox) {
			this.frm.msgbox = frappe.msgprint(
				`<a class="btn btn-primary" onclick="cur_frm.print_preview.printit(true)" style="margin-right: 5px;">
					${__('Print')}</a>
				<a class="btn btn-default">
					${__('New')}</a>`
			);

			$(this.frm.msgbox.body).find('.btn-default').on('click', () => {
				this.frm.msgbox.hide();
				this.make_new_invoice();
			})
		}
	}

	on_change_pos_profile() {
		return frappe.run_serially([
			() => this.make_sales_invoice_frm(),
			() => {
				this.frm.doc.pos_profile = this.pos_profile;
				this.set_pos_profile_data()
					.then(() => {
						this.reset_cart();
						if (this.items) {
							this.items.reset_items();
						}
					});
			}
		]);
	}

	get_default_pos_profile(company) {
		return frappe.xcall("erpnext.stock.get_item_details.get_pos_profile",
			{'company': company})
	}

	setup_company() {
		return new Promise(resolve => {
			if(!this.frm.doc.company) {
				frappe.prompt({fieldname:"company", options: "Company", fieldtype:"Link",
					label: __("Select Company"), reqd: 1}, (data) => {
						this.company = data.company;
						resolve(this.company);
				}, __("Select Company"));
			} else {
				resolve();
			}
		})
	}

	make_new_invoice() {
		return frappe.run_serially([
			() => this.make_sales_invoice_frm(),
			() => this.set_pos_profile_data(),
			() => {
				if (this.cart) {
					this.cart.frm = this.frm;
					this.cart.reset();
				} else {
					this.make_items();
					this.make_cart();
				}
				this.toggle_editing(true);
			},
		]);
	}

	reset_cart() {
		this.cart.frm = this.frm;
		this.cart.reset();
		this.items.reset_search_field();
	}

	make_sales_invoice_frm() {
		const doctype = 'Sales Invoice';
		return new Promise(resolve => {
			if (this.frm) {
				this.frm = get_frm(this.frm);
				if(this.company) {
					this.frm.doc.company = this.company;
				}

				resolve();
			} else {
				frappe.model.with_doctype(doctype, () => {
					this.frm = get_frm();
					resolve();
				});
			}
		});

		function get_frm(_frm) {
			const page = $('<div>');
			const frm = _frm || new frappe.ui.form.Form(doctype, page, false);
			const name = frappe.model.make_new_doc_and_get_name(doctype, true);
			frm.refresh(name);
			frm.doc.items = [];
			frm.doc.is_pos = 1;

			return frm;
		}
	}

	set_pos_profile_data() {
		if (this.company) {
			this.frm.doc.company = this.company;
		}

		if (!this.frm.doc.company) {
			return;
		}

		return new Promise(resolve => {
			return this.frm.call({
				doc: this.frm.doc,
				method: "set_missing_values",
			}).then((r) => {
				if(!r.exc) {
					if (!this.frm.doc.pos_profile) {
						frappe.dom.unfreeze();
						this.raise_exception_for_pos_profile();
					}
					this.frm.script_manager.trigger("update_stock");
					frappe.model.set_default_values(this.frm.doc);
					this.frm.cscript.calculate_taxes_and_totals();

					if (r.message) {
						this.frm.meta.default_print_format = r.message.print_format || "";
						this.frm.allow_edit_rate = r.message.allow_edit_rate;
						this.frm.allow_edit_discount = r.message.allow_edit_discount;
						this.frm.doc.campaign = r.message.campaign;
					}
				}

				resolve();
			});
		});
	}

	prepare_menu() {
		var me = this;
		this.page.clear_menu();

		// for mobile
		// this.page.add_menu_item(__("Pay"), function () {
		//
		// }).addClass('visible-xs');

		this.page.add_menu_item(__('Return to board'), function() {
			frappe.ui.toolbar.clear_cache();
			frappe.set_route('#table-board');
		});

		this.page.add_menu_item(__('POS Settings'), function() {
			frappe.set_route('Form', 'POS Settings');
		});

		this.page.add_menu_item(__('Close the POS'), function() {
			var voucher = frappe.model.get_new_doc('POS Closing Voucher');
			voucher.pos_profile = me.frm.doc.pos_profile;
			voucher.user = frappe.session.user;
			voucher.company = me.frm.doc.company;
			voucher.period_start_date = me.frm.doc.posting_date;
			voucher.period_end_date = me.frm.doc.posting_date;
			voucher.posting_date = me.frm.doc.posting_date;
			frappe.set_route('Form', 'POS Closing Voucher', voucher.name);
		});

	}

	prepare_actions() {
		var me = this;

		this.page.add_action_item(__("Precount"), function() {
			frappe.xcall("erpnext.restaurant.page.restaurant_pos.restaurant_pos.get_precount",
				{'order': me.frm.doc.restaurant_order}).then((r) => {
					window.open("/printview?doctype=Restaurant%20Order&name=" + me.frm.doc.restaurant_order + "&trigger_print=1&format=Estandar&no_letterhead=0&_lang=es");
				})
		});

		this.page.add_action_item(__("Cancel Order"), function() {
			frappe.xcall("erpnext.restaurant.page.restaurant_pos.restaurant_pos.cancel_restaurant_order",
				{'order': me.frm.doc.restaurant_order}).then((r) => {
					frappe.ui.toolbar.clear_cache();
					frappe.set_route('#table-board');
				})
		});

		this.page.add_action_item(__("Change Table"), function() {
			if (me.frm.doc.restaurant_table){
				frappe.db.get_list("Restaurant Table", {filters: {occupied: 0}, fields: ['name']}).then((free_tables) => {
					var table_options = ""
					free_tables.forEach((free_table) => {
						table_options = table_options + "\n" + free_table.name;
					})
					frappe.prompt([
						{'fieldname': 'table', 'fieldtype': 'Select', 'options': table_options, 'label': 'New Table', 'reqd': 1}  
					],
					function(values){
						frappe.xcall("erpnext.restaurant.page.restaurant_pos.restaurant_pos.update_order_table",
							{'order': me.frm.doc.restaurant_order, 'table': values['table']}).then((r) => {
								frappe.ui.toolbar.clear_cache();
								frappe.set_route('#table-board');
							})
					},
					'Change Table',
					'Change'
					)
				})
			}
		});
		
	}

	set_form_action() {
		if(this.frm.doc.docstatus == 1 || (this.frm.doc.allow_print_before_pay == 1&&this.frm.doc.items.length>0)){
			this.page.set_secondary_action(__("Print"), async() => {
				if(this.frm.doc.docstatus != 1 ){
					await this.frm.save();
				}
				this.frm.print_preview.printit(true);
			});
		}
		if(this.frm.doc.items.length == 0){
			this.page.clear_secondary_action();
		}

		if (this.frm.doc.docstatus == 1) {
			this.page.set_primary_action(__("New"), () => {
				this.make_new_invoice();
			});
			this.page.add_menu_item(__("Email"), () => {
				this.frm.email_doc();
			});
		}
	}
};

const [Qty,Disc,Rate,Del,Pay] = [__("Qty"), __('Disc'), __('Rate'), __('Del'), __('Pay')];

class POSCart {
	constructor({frm, wrapper, events}) {
		this.frm = frm;
		this.item_data = {};
		this.wrapper = wrapper;
		this.events = events;
		this.make();
		this.bind_events();
	}

	make() {
		this.make_dom();
		this.make_customer_field();
		this.make_loyalty_points();
		this.make_numpad();
	}

	make_dom() {
		this.wrapper.append(`
			<div class="pos-cart">
				<div class="customer-field">
				</div>
				<div class="cart-wrapper">
					<div class="list-item-table">
						<div class="list-item list-item--head">
							<div class="list-item__content list-item__content--flex-1.5 text-muted">${__('Item Name')}</div>
							<div class="list-item__content text-muted text-right">${__('Quantity')}</div>
							<div class="list-item__content text-muted text-right">${__('Discount')}</div>
							<div class="list-item__content text-muted text-right">${__('Obs')}</div>
							<div class="list-item__content text-muted text-right">${__('Rate')}</div>
						</div>
						<div class="cart-items">
							<div class="empty-state">
								<span>${__('No Items added to cart')}</span>
							</div>
						</div>
						<div class="taxes-and-totals">
							${this.get_taxes_and_totals()}
						</div>
						<div class="discount-amount">`+
						(!this.frm.allow_edit_discount ? `` : `${this.get_discount_amount()}`)+
						`</div>
						<div class="grand-total">
							${this.get_grand_total()}
						</div>
						<div class="quantity-total">
							${this.get_item_qty_total()}
						</div>
					</div>
				</div>
				<div class="row">
					<div class="number-pad-container col-sm-6"></div>
					<div class="col-sm-6 loyalty-program-section">
						<div class="loyalty-program-field"> </div>
					</div>
				</div>
			</div>
		`);


		this.$cart_items = this.wrapper.find('.cart-items');
		this.$empty_state = this.wrapper.find('.cart-items .empty-state');
		this.$taxes_and_totals = this.wrapper.find('.taxes-and-totals');
		this.$discount_amount = this.wrapper.find('.discount-amount');
		this.$grand_total = this.wrapper.find('.grand-total');
		this.$qty_total = this.wrapper.find('.quantity-total');
		// this.$loyalty_button = this.wrapper.find('.loyalty-button');

		// this.$loyalty_button.on('click', () => {
		// 	this.loyalty_button.show();
		// })

		this.toggle_taxes_and_totals(false);
		this.$grand_total.on('click', () => {
			this.toggle_taxes_and_totals();
		});
	}

	reset() {
		this.$cart_items.find('.list-item').remove();
		this.$empty_state.show();
		this.$taxes_and_totals.html(this.get_taxes_and_totals());
		this.numpad && this.numpad.reset_value();
		this.customer_field.set_value("");
		this.frm.msgbox = "";

		let total_item_qty = 0.0;
		this.frm.set_value("pos_total_qty",total_item_qty);

		this.$discount_amount.find('input:text').val('');
		this.wrapper.find('.grand-total-value').text(
			format_currency(this.frm.doc.grand_total, this.frm.currency));
		this.wrapper.find('.rounded-total-value').text(
			format_currency(this.frm.doc.rounded_total, this.frm.currency));
		this.$qty_total.find(".quantity-total").text(total_item_qty);

		const customer = this.frm.doc.customer;
		this.customer_field.set_value(customer);

		if (this.numpad) {
			const disable_btns = this.disable_numpad_control()
			const enable_btns = [__('Rate'), __('Disc')]

			if (disable_btns) {
				enable_btns.filter(btn => !disable_btns.includes(btn))
			}

			this.numpad.enable_buttons(enable_btns);
		}
	}

	get_grand_total() {
		let total = this.get_total_template('Grand Total', 'grand-total-value');

		if (!cint(frappe.sys_defaults.disable_rounded_total)) {
			total += this.get_total_template('Rounded Total', 'rounded-total-value');
		}

		return total;
	}

	get_item_qty_total() {
		let total = this.get_total_template('Total Qty', 'quantity-total');
		return total;
	}

	get_total_template(label, class_name) {
		return `
			<div class="list-item">
				<div class="list-item__content text-muted">${__(label)}</div>
				<div class="list-item__content list-item__content--flex-2 ${class_name}">0.00</div>
			</div>
		`;
	}

	get_discount_amount() {
		const get_currency_symbol = window.get_currency_symbol;

		return `
			<div class="list-item">
				<div class="list-item__content list-item__content--flex-2 text-muted">${__('Discount')}</div>
				<div class="list-item__content discount-inputs">
					<input type="text"
						class="form-control additional_discount_percentage text-right"
						placeholder="% 0.00"
					>
					<input type="text"
						class="form-control discount_amount text-right"
						placeholder="${get_currency_symbol(this.frm.doc.currency)} 0.00"
					>
				</div>
			</div>
		`;
	}

	get_taxes_and_totals() {
		return `
			<div class="list-item">
				<div class="list-item__content list-item__content--flex-2 text-muted">${__('Net Total')}</div>
				<div class="list-item__content net-total">0.00</div>
			</div>
			<div class="list-item">
				<div class="list-item__content list-item__content--flex-2 text-muted">${__('Taxes')}</div>
				<div class="list-item__content taxes">0.00</div>
			</div>
		`;
	}

	toggle_taxes_and_totals(flag) {
		if (flag !== undefined) {
			this.tax_area_is_shown = flag;
		} else {
			this.tax_area_is_shown = !this.tax_area_is_shown;
		}

		this.$taxes_and_totals.toggle(this.tax_area_is_shown);
		this.$discount_amount.toggle(this.tax_area_is_shown);
	}

	update_taxes_and_totals() {
		if (!this.frm.doc.taxes) { return; }

		const currency = this.frm.doc.currency;
		this.frm.refresh_field('taxes');

		// Update totals
		this.$taxes_and_totals.find('.net-total')
			.html(format_currency(this.frm.doc.total, currency));

		// Update taxes
		const taxes_html = this.frm.doc.taxes.map(tax => {
			return `
				<div>
					<span>${tax.description}</span>
					<span class="text-right bold">
						${format_currency(tax.tax_amount, currency)}
					</span>
				</div>
			`;
		}).join("");
		this.$taxes_and_totals.find('.taxes').html(taxes_html);
	}

	update_grand_total() {
		this.$grand_total.find('.grand-total-value').text(
			format_currency(this.frm.doc.grand_total, this.frm.currency)
		);

		this.$grand_total.find('.rounded-total-value').text(
			format_currency(this.frm.doc.rounded_total, this.frm.currency)
		);

		frappe.xcall('erpnext.restaurant.page.restaurant_pos.restaurant_pos.update_order_totals', 
			{"order": this.frm.doc.restaurant_order, "grand_total": this.frm.doc.grand_total,
			"total_taxes_and_charges": this.frm.doc.total_taxes_and_charges}).then((r) => {})
	}

	update_qty_total() {
		var total_item_qty = 0;
		$.each(this.frm.doc["items"] || [], function (i, d) {
				if (d.qty > 0) {
					total_item_qty += d.qty;
				}
		});
		this.$qty_total.find('.quantity-total').text(total_item_qty);
		this.frm.set_value("pos_total_qty",total_item_qty);
	}

	make_customer_field() {
		this.customer_field = frappe.ui.form.make_control({
			df: {
				fieldtype: 'Link',
				label: 'Customer',
				fieldname: 'customer',
				options: 'Customer',
				reqd: 1,
				get_query: function() {
					return {
						query: 'erpnext.controllers.queries.customer_query'
					}
				},
				onchange: () => {
					this.events.on_customer_change(this.customer_field.get_value());
					this.events.get_loyalty_details();
				}
			},
			parent: this.wrapper.find('.customer-field'),
			render_input: true
		});

		this.customer_field.set_value(this.frm.doc.customer);
	}


	make_loyalty_points() {
		this.available_loyalty_points = frappe.ui.form.make_control({
			df: {
				fieldtype: 'Int',
				label: 'Available Loyalty Points',
				read_only: 1,
				fieldname: 'available_loyalty_points'
			},
			parent: this.wrapper.find('.loyalty-program-field')
		});
		this.available_loyalty_points.set_value(this.frm.doc.loyalty_points);
	}


	disable_numpad_control() {
		let disabled_btns = [];
		if(!this.frm.allow_edit_rate) {
			disabled_btns.push(__('Rate'));
		}
		if(!this.frm.allow_edit_discount) {
			disabled_btns.push(__('Disc'));
		}
		return disabled_btns;
	}


	make_numpad() {

		var pay_class = {}
		pay_class[__('Pay')]='brand-primary'
		this.numpad = new NumberPad({
			button_array: [
				[1, 2, 3, Qty],
				[4, 5, 6, Disc],
				[7, 8, 9, Rate],
				[Del, 0, '.', Pay]
			],
			add_class: pay_class,
			disable_highlight: [Qty, Disc, Rate, Pay],
			reset_btns: [Qty, Disc, Rate, Pay],
			del_btn: Del,
			disable_btns: this.disable_numpad_control(),
			wrapper: this.wrapper.find('.number-pad-container'),
			onclick: (btn_value) => {
				// on click

				if (!this.selected_item && btn_value !== Pay) {
					frappe.show_alert({
						indicator: 'red',
						message: __('Please select an item in the cart')
					});
					return;
				}
				if ([Qty, Disc, Rate].includes(btn_value)) {
					this.set_input_active(btn_value);
				} else if (btn_value !== Pay) {
					if (!this.selected_item.active_field) {
						frappe.show_alert({
							indicator: 'red',
							message: __('Please select a field to edit from numpad')
						});
						return;
					}

					if (this.selected_item.active_field == 'discount_percentage' && this.numpad.get_value() > cint(100)) {
						frappe.show_alert({
							indicator: 'red',
							message: __('Discount amount cannot be greater than 100%')
						});
						this.numpad.reset_value();
					} else {
						const item_code = unescape(this.selected_item.attr('data-item-code'));
						const batch_no = this.selected_item.attr('data-batch-no');
						const field = this.selected_item.active_field;
						const value = this.numpad.get_value();

						this.events.on_field_change(item_code, field, value, batch_no);
					}
				}

				this.events.on_numpad(btn_value);
			}
		});
	}

	set_input_active(btn_value) {
		this.selected_item.removeClass('qty disc rate');

		this.numpad.set_active(btn_value);
		if (btn_value === Qty) {
			this.selected_item.addClass('qty');
			this.selected_item.active_field = 'qty';
		} else if (btn_value == Disc) {
			this.selected_item.addClass('disc');
			this.selected_item.active_field = 'discount_percentage';
		} else if (btn_value == Rate) {
			this.selected_item.addClass('rate');
			this.selected_item.active_field = 'rate';
		}
	}

	add_item(item) {
		this.$empty_state.hide();

		if (this.exists(item.item_code, item.batch_no)) {
			// update quantity
			this.update_item(item);
		} else if (flt(item.qty) > 0.0) {
			// add to cart
			const $item = $(this.get_item_html(item));
			$item.appendTo(this.$cart_items);
		}
		this.highlight_item(item.item_code);
	}

	update_item(item) {
		const item_selector = item.batch_no ?
			`[data-batch-no="${item.batch_no}"]` : `[data-item-code="${escape(item.item_code)}"]`;

		const $item = this.$cart_items.find(item_selector);

		if(item.qty > 0) {
			const is_stock_item = this.get_item_details(item.item_code).is_stock_item;
			const indicator_class = (!is_stock_item || item.actual_qty >= item.qty) ? 'green' : 'red';
			const remove_class = indicator_class == 'green' ? 'red' : 'green';

			$item.find('.quantity input').val(item.qty);
			$item.find('.discount').text(item.discount_percentage + '%');
			$item.find('.rate').text(format_currency(item.rate, this.frm.doc.currency));
			$item.addClass(indicator_class);
			$item.removeClass(remove_class);
		} else {
			$item.remove();
		}
	}

	get_item_html(item) {
		const is_stock_item = this.get_item_details(item.item_code).is_stock_item;
		const rate = format_currency(item.rate, this.frm.doc.currency);
		const indicator_class = (!is_stock_item || item.actual_qty >= item.qty) ? 'green' : 'red';
		const batch_no = item.batch_no || '';
		const obs = item.observations || ''

		return `
			<div class="list-item indicator ${indicator_class}" data-item-code="${escape(item.item_code)}"
				data-batch-no="${batch_no}" title="Item: ${item.item_name}  Available Qty: ${item.actual_qty}">
				<div class="item-name list-item__content list-item__content--flex-1.5 ellipsis">
					${item.item_name}
				</div>
				<div class="quantity list-item__content text-right">
					${get_quantity_html(item.qty)}
				</div>
				<div class="discount list-item__content text-right">
					${item.discount_percentage}%
				</div>
				<div class="observations list-item__content text-right">
					${get_observations_html(obs)}
				</div>
				<div class="rate list-item__content text-right">
					${rate}
				</div>
			</div>
		`;

		function get_quantity_html(value) {
			return `
				<div class="input-group input-group-xs">
					<span class="input-group-btn">
						<button class="btn btn-default btn-xs" data-action="increment">+</button>
					</span>

					<input class="form-control" type="number" value="${value}">

					<span class="input-group-btn">
						<button class="btn btn-default btn-xs" data-action="decrement">-</button>
					</span>
				</div>
			`;
		}

		function get_observations_html(value) {
			return `
				<div class="input-group input-group-xs">
					<input class="form-control" type="text" value="${value}">
				</div>
			`;
		}
	}

	get_item_details(item_code) {
		if (!this.item_data[item_code]) {
			this.item_data[item_code] = this.events.get_item_details(item_code);
		}
		
		return this.item_data[item_code];
	}

	exists(item_code, batch_no) {
		const is_exists = batch_no ?
			`[data-batch-no="${batch_no}"]` : `[data-item-code="${escape(item_code)}"]`;

		let $item = this.$cart_items.find(is_exists);

		return $item.length > 0;
	}

	highlight_item(item_code) {
		const $item = this.$cart_items.find(`[data-item-code="${escape(item_code)}"]`);
		$item.addClass('highlight');
		setTimeout(() => $item.removeClass('highlight'), 1000);
	}

	scroll_to_item(item_code) {
		const $item = this.$cart_items.find(`[data-item-code="${escape(item_code)}"]`);
		if ($item.length === 0) return;
		const scrollTop = $item.offset().top - this.$cart_items.offset().top + this.$cart_items.scrollTop();
		this.$cart_items.animate({ scrollTop });
	}

	bind_events() {
		const me = this;
		const events = this.events;

		// quantity change
		this.$cart_items.on('click',
			'[data-action="increment"], [data-action="decrement"]', function() {
				const $btn = $(this);
				const $item = $btn.closest('.list-item[data-item-code]');
				const item_code = unescape($item.attr('data-item-code'));
				const action = $btn.attr('data-action');

				if(action === 'increment') {
					events.on_field_change(item_code, 'qty', '+1');
				} else if(action === 'decrement') {
					events.on_field_change(item_code, 'qty', '-1');
				}
			});

		this.$cart_items.on('change', '.quantity input', function() {
			const $input = $(this);
			const $item = $input.closest('.list-item[data-item-code]');
			const item_code = unescape($item.attr('data-item-code'));
			events.on_field_change(item_code, 'qty', flt($input.val()));
		});

		this.$cart_items.on('change', '.observations input', function() {
			const $input = $(this);
			const $item = $input.closest('.list-item[data-item-code]');
			const item_code = unescape($item.attr('data-item-code'));
			const item = me.frm.doc.items.find(i => i['item_code'] === item_code);
			item["observations"] = $input.val();
			frappe.xcall('erpnext.restaurant.page.restaurant_pos.restaurant_pos.update_order_items', 
				{"order": me.frm.doc.restaurant_order, "items": me.frm.doc.items}).then((r) => {})
		});

		// current item
		this.$cart_items.on('click', '.list-item', function() {
			me.set_selected_item($(this));
		});

		this.wrapper.find('.additional_discount_percentage').on('change', (e) => {
			const discount_percentage = flt(e.target.value,
				precision("additional_discount_percentage"));

			frappe.model.set_value(this.frm.doctype, this.frm.docname,
				'additional_discount_percentage', discount_percentage)
				.then(() => {
					let discount_wrapper = this.wrapper.find('.discount_amount');
					discount_wrapper.val(flt(this.frm.doc.discount_amount,
						precision('discount_amount')));
					discount_wrapper.trigger('change');
				});
		});

		this.wrapper.find('.discount_amount').on('change', (e) => {
			const discount_amount = flt(e.target.value, precision('discount_amount'));
			frappe.model.set_value(this.frm.doctype, this.frm.docname,
				'discount_amount', discount_amount);
			this.frm.trigger('discount_amount')
				.then(() => {
					this.update_discount_fields();
					this.update_taxes_and_totals();
					this.update_grand_total();
				});
		});
	}

	update_discount_fields() {
		let discount_wrapper = this.wrapper.find('.additional_discount_percentage');
		let discount_amt_wrapper = this.wrapper.find('.discount_amount');
		discount_wrapper.val(flt(this.frm.doc.additional_discount_percentage,
			precision('additional_discount_percentage')));
		discount_amt_wrapper.val(flt(this.frm.doc.discount_amount,
			precision('discount_amount')));
	}

	set_selected_item($item) {
		this.selected_item = $item;
		this.$cart_items.find('.list-item').removeClass('current-item qty disc rate');
		this.selected_item.addClass('current-item');
		this.events.on_select_change();
	}

	unselect_all() {
		this.$cart_items.find('.list-item').removeClass('current-item qty disc rate');
		this.selected_item = null;
		this.events.on_select_change();
	}
}

class POSItems {
	constructor({wrapper, frm, events}) {
		this.wrapper = wrapper;
		this.frm = frm;
		this.items = {};
		this.events = events;
		this.currency = this.frm.doc.currency;

		frappe.db.get_value("Item Group", {lft: 1, is_group: 1}, "name", (r) => {
			this.parent_item_group = r.name;
			this.make_dom();
			this.make_fields();

			this.init_clusterize();
			this.bind_events();
			this.load_items_data();
		})
	}

	load_items_data() {
		// bootstrap with 20 items
		this.get_items()
			.then(({ items }) => {
				this.all_items = items;
				this.items = items;
				this.render_items(items);
			});
	}

	reset_items() {
		this.wrapper.find('.pos-items').empty();
		this.init_clusterize();
		this.load_items_data();
	}

	make_dom() {
		this.wrapper.html(`
			<div class="fields">
				<div class="search-field">
				</div>
				<div class="item-group-field">
				</div>
			</div>
			<div class="items-wrapper">
			</div>
		`);

		this.items_wrapper = this.wrapper.find('.items-wrapper');
		this.items_wrapper.append(`
			<div class="list-item-table pos-items-wrapper">
				<div class="pos-items image-view-container">
				</div>
			</div>
		`);
	}

	make_fields() {
		// Search field
		const me = this;
		this.search_field = frappe.ui.form.make_control({
			df: {
				fieldtype: 'Data',
				label: __('Search Item (Ctrl + i)'),
				placeholder: __('Search by item code, serial number, batch no or barcode')
			},
			parent: this.wrapper.find('.search-field'),
			render_input: true,
		});

		frappe.ui.keys.on('ctrl+i', () => {
			this.search_field.set_focus();
		});

		this.search_field.$input.on('input', (e) => {
			clearTimeout(this.last_search);
			this.last_search = setTimeout(() => {
				const search_term = e.target.value;
				const item_group = this.item_group_field ?
					this.item_group_field.get_value() : '';

				this.filter_items({ search_term:search_term,  item_group: item_group});
			}, 300);
		});

		this.item_group_field = frappe.ui.form.make_control({
			df: {
				fieldtype: 'Link',
				label: 'Item Group',
				options: 'Item Group',
				default: me.parent_item_group,
				onchange: () => {
					const item_group = this.item_group_field.get_value();
					if (item_group) {
						this.filter_items({ item_group: item_group });
					}
				},
				get_query: () => {
					return {
						query: 'erpnext.selling.page.point_of_sale.point_of_sale.item_group_query',
						filters: {
							pos_profile: this.frm.doc.pos_profile
						}
					};
				}
			},
			parent: this.wrapper.find('.item-group-field'),
			render_input: true
		});
	}

	init_clusterize() {
		this.clusterize = new Clusterize({
			scrollElem: this.wrapper.find('.pos-items-wrapper')[0],
			contentElem: this.wrapper.find('.pos-items')[0],
			rows_in_block: 6
		});
	}

	render_items(items) {
		let _items = items || this.items;

		const all_items = Object.values(_items).map(item => this.get_item_html(item));
		let row_items = [];

		const row_container = '<div class="image-view-row">';
		let curr_row = row_container;

		for (let i=0; i < all_items.length; i++) {
			// wrap 4 items in a div to emulate
			// a row for clusterize
			if(i % 4 === 0 && i !== 0) {
				curr_row += '</div>';
				row_items.push(curr_row);
				curr_row = row_container;
			}
			curr_row += all_items[i];

			if(i == all_items.length - 1) {
				row_items.push(curr_row);
			}
		}

		this.clusterize.update(row_items);
	}

	filter_items({ search_term='', item_group=this.parent_item_group }={}) {
		if (search_term) {
			search_term = search_term.toLowerCase();

			// memoize
			this.search_index = this.search_index || {};
			if (this.search_index[search_term]) {
				const items = this.search_index[search_term];
				this.items = items;
				this.render_items(items);
				this.set_item_in_the_cart(items);
				return;
			}
		} else if (item_group == this.parent_item_group) {
			this.items = this.all_items;
			return this.render_items(this.all_items);
		}

		this.get_items({search_value: search_term, item_group })
			.then(({ items, serial_no, batch_no, barcode }) => {
				if (search_term && !barcode) {
					this.search_index[search_term] = items;
				}

				this.items = items;
				this.render_items(items);
				this.set_item_in_the_cart(items, serial_no, batch_no, barcode);
			});
	}

	set_item_in_the_cart(items, serial_no, batch_no, barcode) {
		if (serial_no) {
			this.events.update_cart(items[0].item_code,
				'serial_no', serial_no);
			this.reset_search_field();
			return;
		}

		if (batch_no) {
			this.events.update_cart(items[0].item_code,
				'batch_no', batch_no);
			this.reset_search_field();
			return;
		}

		if (items.length === 1 && (serial_no || batch_no || barcode)) {
			this.events.update_cart(items[0].item_code,
				'qty', '+1');
			this.reset_search_field();
		}
	}

	reset_search_field() {
		this.search_field.set_value('');
		this.search_field.$input.trigger("input");
	}

	bind_events() {
		var me = this;
		this.wrapper.on('click', '.pos-item-wrapper', function() {
			const $item = $(this);
			const item_code = unescape($item.attr('data-item-code'));
			me.events.update_cart(item_code, 'qty', '+1');
		});
	}

	get(item_code) {
		let item = {};
		this.items.map(data => {
			if (data.item_code === item_code) {
				item = data;
			}
		})

		return item
	}

	get_all() {
		return this.items;
	}

	get_item_html(item) {
		const price_list_rate = format_currency(item.price_list_rate, this.currency);
		const { item_code, item_name, item_image} = item;
		const item_title = item_name || item_code;

		const template = `
			<div class="pos-item-wrapper image-view-item" data-item-code="${escape(item_code)}">
				<div class="image-view-header">
					<div>
						<a class="grey list-id" data-name="${item_code}" title="${item_title}">
							${item_title}
						</a>
					</div>
				</div>
				<div class="image-view-body">
					<a	data-item-code="${item_code}"
						title="${item_title}"
					>
						<div class="image-field"
							style="${!item_image ? 'background-color: #fafbfc;' : ''} border: 0px;"
						>
							${!item_image ? `<span class="placeholder-text">
									${frappe.get_abbr(item_title)}
								</span>` : '' }
							${item_image ? `<img src="${item_image}" alt="${item_title}">` : '' }
						</div>
						<span class="price-info">
							${price_list_rate}
						</span>
					</a>
				</div>
			</div>
		`;

		return template;
	}

	get_items({start = 0, page_length = 40, search_value='', item_group=this.parent_item_group}={}) {
		const price_list = this.frm.doc.selling_price_list;
		return new Promise(res => {
			frappe.call({
				method: "erpnext.selling.page.point_of_sale.point_of_sale.get_items",
				freeze: true,
				args: {
					start,
					page_length,
					price_list,
					item_group,
					search_value,
					pos_profile: this.frm.doc.pos_profile
				}
			}).then(r => {
				// const { items, serial_no, batch_no } = r.message;

				// this.serial_no = serial_no || "";
				res(r.message);
			});
		});
	}
}

class NumberPad {
	constructor({
		wrapper, onclick, button_array,
		add_class={}, disable_highlight=[],
		reset_btns=[], del_btn='', disable_btns
	}) {
		this.wrapper = wrapper;
		this.onclick = onclick;
		this.button_array = button_array;
		this.add_class = add_class;
		this.disable_highlight = disable_highlight;
		this.reset_btns = reset_btns;
		this.del_btn = del_btn;
		this.disable_btns = disable_btns || [];
		this.make_dom();
		this.bind_events();
		this.value = '';
	}

	make_dom() {
		if (!this.button_array) {
			this.button_array = [
				[1, 2, 3],
				[4, 5, 6],
				[7, 8, 9],
				['', 0, '']
			];
		}

		this.wrapper.html(`
			<div class="number-pad">
				${this.button_array.map(get_row).join("")}
			</div>
		`);

		function get_row(row) {
			return '<div class="num-row">' + row.map(get_col).join("") + '</div>';
		}

		function get_col(col) {
			return `<div class="num-col" data-value="${col}"><div>${col}</div></div>`;
		}

		this.set_class();

		if(this.disable_btns) {
			this.disable_btns.forEach((btn) => {
				const $btn = this.get_btn(btn);
				$btn.prop("disabled", true)
				$btn.hover(() => {
					$btn.css('cursor','not-allowed');
				})
			})
		}
	}

	enable_buttons(btns) {
		btns.forEach((btn) => {
			const $btn = this.get_btn(btn);
			$btn.prop("disabled", false)
			$btn.hover(() => {
				$btn.css('cursor','pointer');
			})
		})
	}

	set_class() {
		for (const btn in this.add_class) {
			const class_name = this.add_class[btn];
			this.get_btn(btn).addClass(class_name);
		}
	}

	bind_events() {
		// bind click event
		const me = this;
		this.wrapper.on('click', '.num-col', function() {
			const $btn = $(this);
			const btn_value = $btn.attr('data-value');
			if (!me.disable_highlight.includes(btn_value)) {
				me.highlight_button($btn);
			}
			if (me.reset_btns.includes(btn_value)) {
				me.reset_value();
			} else {
				if (btn_value === me.del_btn) {
					me.value = me.value.substr(0, me.value.length - 1);
				} else {
					me.value += btn_value;
				}
			}
			me.onclick(btn_value);
		});
	}

	reset_value() {
		this.value = '';
	}

	get_value() {
		return flt(this.value);
	}

	get_btn(btn_value) {
		return this.wrapper.find(`.num-col[data-value="${btn_value}"]`);
	}

	highlight_button($btn) {
		$btn.addClass('highlight');
		setTimeout(() => $btn.removeClass('highlight'), 1000);
	}

	set_active(btn_value) {
		const $btn = this.get_btn(btn_value);
		this.wrapper.find('.num-col').removeClass('active');
		$btn.addClass('active');
	}

	set_inactive() {
		this.wrapper.find('.num-col').removeClass('active');
	}
}

class Payment {
	constructor({frm, events}) {
		this.frm = frm;
		this.events = events;
		this.make();
		this.bind_events();
		this.set_primary_action();
	}

	open_modal() {
		this.dialog.show();
	}

	make() {
		this.set_flag();
		this.dialog = new frappe.ui.Dialog({
			fields: this.get_fields(),
			width: 800,
			invoice_frm: this.frm
		});

		this.set_title();

		this.$body = this.dialog.body;

		this.numpad = new NumberPad({
			wrapper: $(this.$body).find('[data-fieldname="numpad"]'),
			button_array: [
				[1, 2, 3],
				[4, 5, 6],
				[7, 8, 9],
				[__('Del'), 0, '.'],
			],
			onclick: () => {
				if(this.fieldname) {
					this.dialog.set_value(this.fieldname, this.numpad.get_value());
				}
			}
		});
	}

	set_title() {
		let title = __('Total Amount {0}',
			[format_currency(this.frm.doc.rounded_total || this.frm.doc.grand_total,
			this.frm.doc.currency)]);

		this.dialog.set_title(title);
	}

	bind_events() {
		var me = this;
		$(this.dialog.body).find('.input-with-feedback').focusin(function() {
			me.numpad.reset_value();
			me.fieldname = $(this).prop('dataset').fieldname;
			if (me.frm.doc.outstanding_amount > 0 &&
				!in_list(['write_off_amount', 'change_amount'], me.fieldname)) {
				me.frm.doc.payments.forEach((data) => {
					if (data.mode_of_payment == me.fieldname && !data.amount) {
						me.dialog.set_value(me.fieldname,
							me.frm.doc.outstanding_amount / me.frm.doc.conversion_rate);
						return;
					}
				})
			}
		});
	}

	set_primary_action() {
		var me = this;

		this.dialog.set_primary_action(__("Submit"), function() {
			me.dialog.hide();
			me.events.submit_form();
		});
	}

	get_fields() {
		const me = this;

		let fields = this.frm.doc.payments.map(p => {
			return {
				fieldtype: 'Currency',
				label: __(p.mode_of_payment),
				options: me.frm.doc.currency,
				fieldname: p.mode_of_payment,
				default: p.amount,
				onchange: () => {
					const value = this.dialog.get_value(this.fieldname) || 0;
					me.update_payment_value(this.fieldname, value);
				}
			};
		});

		fields = fields.concat([
			{
				fieldtype: 'Column Break',
			},
			{
				fieldtype: 'HTML',
				fieldname: 'numpad'
			},
			{
				fieldtype: 'Section Break',
				depends_on: 'eval: this.invoice_frm.doc.loyalty_program'
			},
			{
				fieldtype: 'Check',
				label: 'Redeem Loyalty Points',
				fieldname: 'redeem_loyalty_points',
				onchange: () => {
					me.update_cur_frm_value("redeem_loyalty_points", () => {
						frappe.flags.redeem_loyalty_points = false;
						me.update_loyalty_points();
					});
				}
			},
			{
				fieldtype: 'Column Break',
			},
			{
				fieldtype: 'Int',
				fieldname: "loyalty_points",
				label: __("Loyalty Points"),
				depends_on: "redeem_loyalty_points",
				onchange: () => {
					me.update_cur_frm_value("loyalty_points", () => {
						frappe.flags.loyalty_points = false;
						me.update_loyalty_points();
					});
				}
			},
			{
				fieldtype: 'Currency',
				label: __("Loyalty Amount"),
				fieldname: "loyalty_amount",
				options: me.frm.doc.currency,
				read_only: 1,
				depends_on: "redeem_loyalty_points"
			},
			{
				fieldtype: 'Section Break',
			},
			{
				fieldtype: 'Currency',
				label: __("Write off Amount"),
				options: me.frm.doc.currency,
				fieldname: "write_off_amount",
				default: me.frm.doc.write_off_amount,
				onchange: () => {
					me.update_cur_frm_value('write_off_amount', () => {
						frappe.flags.change_amount = false;
						me.update_change_amount();
					});
				}
			},
			{
				fieldtype: 'Column Break',
			},
			{
				fieldtype: 'Currency',
				label: __("Change Amount"),
				options: me.frm.doc.currency,
				fieldname: "change_amount",
				default: me.frm.doc.change_amount,
				onchange: () => {
					me.update_cur_frm_value('change_amount', () => {
						frappe.flags.write_off_amount = false;
						me.update_write_off_amount();
					});
				}
			},
			{
				fieldtype: 'Section Break',
			},
			{
				fieldtype: 'Currency',
				label: __("Paid Amount"),
				options: me.frm.doc.currency,
				fieldname: "paid_amount",
				default: me.frm.doc.paid_amount,
				read_only: 1
			},
			{
				fieldtype: 'Column Break',
			},
			{
				fieldtype: 'Currency',
				label: __("Outstanding Amount"),
				options: me.frm.doc.currency,
				fieldname: "outstanding_amount",
				default: me.frm.doc.outstanding_amount,
				read_only: 1
			},
		]);

		return fields;
	}

	set_flag() {
		frappe.flags.write_off_amount = true;
		frappe.flags.change_amount = true;
		frappe.flags.loyalty_points = true;
		frappe.flags.redeem_loyalty_points = true;
		frappe.flags.payment_method = true;
	}

	update_cur_frm_value(fieldname, callback) {
		if (frappe.flags[fieldname]) {
			const value = this.dialog.get_value(fieldname);
			this.frm.set_value(fieldname, value)
				.then(() => {
					callback();
				});
		}

		frappe.flags[fieldname] = true;
	}

	update_payment_value(fieldname, value) {
		var me = this;
			$.each(this.frm.doc.payments, function(i, data) {
				if (__(data.mode_of_payment) == __(fieldname)) {
					frappe.model.set_value('Sales Invoice Payment', data.name, 'amount', value)
						.then(() => {
							me.update_change_amount();
							me.update_write_off_amount();
						});
				}
			});
	}

	update_change_amount() {
		this.dialog.set_value("change_amount", this.frm.doc.change_amount);
		this.show_paid_amount();
	}

	update_write_off_amount() {
		this.dialog.set_value("write_off_amount", this.frm.doc.write_off_amount);
	}

	show_paid_amount() {
		this.dialog.set_value("paid_amount", this.frm.doc.paid_amount);
		this.dialog.set_value("outstanding_amount", this.frm.doc.outstanding_amount);
	}

	update_payment_amount() {
		var me = this;
		$.each(this.frm.doc.payments, function(i, data) {
			console.log("setting the ", data.mode_of_payment, " for the value", data.amount);
			me.dialog.set_value(data.mode_of_payment, data.amount);
		});
	}

	update_loyalty_points() {
		if (this.dialog.get_value("redeem_loyalty_points")) {
			this.dialog.set_value("loyalty_points", this.frm.doc.loyalty_points);
			this.dialog.set_value("loyalty_amount", this.frm.doc.loyalty_amount);
			this.update_payment_amount();
			this.show_paid_amount();
		}
	}

}