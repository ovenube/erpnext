frappe.pages['kitchen-view'].on_page_load = function(wrapper) {
	new KitchenView(wrapper);
}

KitchenView = Class.extend({
	init: function(wrapper) {
		this.page = frappe.ui.make_app_page({
			parent: wrapper,
			title: "Kitchen View",
			single_column: true
		})

		const assets = [
			'assets/erpnext/css/kitchen_view.css',
			'assets/erpnext/css/table_board.css',
			'assets/erpnext/js/restaurant/kitchen_view.js'
		];

		frappe.require(assets, () => {
			this.make();
		});
	},

	make: function() {
		return frappe.run_serially([
			() => $(frappe.render_template("kitchen_view", this)).appendTo(this.page.main),
			() => this.load_kitchens(),
			() => this.load_kitchen_orders()
		])
	},

	load_kitchens: function() {
		frappe.db.get_list("Restaurant Kitchen", {fields: ["kitchen_name"]}).then((result) => {
			if (result == []){
				frappe.throw(__("Restaurant Kitchen is required to use Kitchen View"));
			} else {
				result.forEach(kitchen => {
					$('#kitchens').append($('<option>').val(kitchen.kitchen_name).text(kitchen.kitchen_name));
				})
			}
		})
	},

	load_kitchen_orders: function() {
		var kitchens = document.getElementById("kitchens");
		kitchens.onchange = function() {
			$('#kitchen-orders').empty();
			var kitchen = kitchens.options[kitchens.selectedIndex].text;
			frappe.xcall('erpnext.restaurant.page.kitchen_view.kitchen_view.get_orders_kitchen',
			{'kitchen': kitchen}).then((r) => {
				r.forEach(order_table => {
					$('#kitchen-orders').append(`
					<div class="col-sm-2 col-xs-4 tableList nohover-item" style="">
						<a class="btn btn-lg kitchentable-btn` + (order_table.order ? "" : " disabled")  +`" href="javascript:void(0)" onclick="openRestauranOrder('` + order_table.order + `')">`+ (order_table.table === undefined ? order_table.time : order_table.table.slice(-2)) +`</a>
					</div>`);
				})
			})
		}
	}
})

