frappe.ready(function(){
    function get_material(cicle, material) {
        frappe.call({
            method: "erpnext.templates.generators.educational_material_print.open_url",
            args: {
                'cicle': cicle,
                'material': material
            },
            callback: function(r) {
                if (r) {
                    window.open(r.message);
                }
            }
        });
    }

    $(".btn-primary").click(function () {
        get_material(doc_info.cicle, $(this).attr('value'));
    });
});