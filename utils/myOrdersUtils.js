import _get from 'lodash/get';
import formatDate from 'date-fns/format';
import { getParentItem, getGroceryBasketFields, segregateOrdersIntoGroups } from 'utils/orderUtils';

const getOrders = data => {
	if (!data) return null;

	const ordersList = _get(data, ['orderGranularDetails']);
	return ordersList ? ordersList.map(order => getOrder(order)) : null;
};

const getOrder = order => {
	if (!order) return null;
	const orderDetailsLinkPreStr = `/order_details?order_id=`;

	return {
		items: getItemGroups(order),
		orderId: _get(order, ['orderId']),
		orderDate: getFormattedDate(_get(order, ['orderDate'])),
		promiseDate: getFormattedDate(_get(order, ['orderLvlPromiseDate'])),
		totalAmount: _get(order, ['amount']),
		numberOfItems: _get(order, ['numberOfItems']),
		orderDetailLink: orderDetailsLinkPreStr + _get(order, ['orderId']),
		orderType: _get(order, ['orderType']),
		orderSubType: _get(order, ['orderSubType']),
		customerInfo: _get(order, ['customerInfo']),
		orderCancellationAllowed: _get(order, ['orderCancellationAllowed']),
		orderNotifications: _get(order, ['orderNotifications', 0])
	};
};

/**
 * Returns a list of all 'items' in the current Order.
 * Takes into account the parent-child relationship between items.
 *
 * @param order		The Order object
 * @returns Array	Array of orderItems in the current Order.
 * 					Child orderItems are added in the childItems array, within the parent items
 */
export const getItemGroups = order => {
	const groupedItems = _get(order, ['groupedItems']);
	const itemTypeGroups = _get(order, ['itemTypeGroups']) || {};

	const basketDetails = getGroceryBasketDetails(itemTypeGroups);

	let items = getItems(groupedItems);

	items = segregateOrdersIntoGroups(order, items, basketDetails);
	return items;
};

const getItems = groupedItems => {
	const mainItems = groupedItems.map(itemList => getItem(itemList));
	let childItemIds = [];

	mainItems.forEach(item => {
		const childItem = _get(item, ['data', 'childItemId']);
		if (childItem) {
			childItemIds = childItemIds.concat(childItem);
		}
	});
	let parentItems = mainItems.filter(item => {
		return childItemIds.indexOf(item.data.itemId) === -1;
	});
	parentItems = parentItems.map(item => {
		const childItemId = _get(item, ['data', 'childItemId']);
		const childItem = mainItems.reduce((childItem, item) => {
			if (childItemId && childItemId.indexOf(item.data.itemId) !== -1) {
				childItem.push(item);
			}
			return childItem;
		}, []);
		item.childItems = [];
		if (childItem && childItem.length) item.childItems = item.childItems.concat(childItem);
		return item;
	});
	return parentItems;
};

const getItem = (item, info) => {
	if (!item) return null;
	return {
		data: getItemInfo(getParentItem(item), info),
		returnDetails: getReturnDetails(item, info),
		refundDetails: getRefundDetails(item)
	};
};

const getItemInfo = (mainItem, info) => {
	if (!mainItem) return null;
	const _item = {
		groupType: _get(mainItem, ['groupType']),
		fsn: _get(mainItem, ['fsn']),
		title: _get(mainItem, ['title']),
		amount: _get(mainItem, ['amount']),
		quantity: _get(mainItem, ['quantity']),
		type: _get(mainItem, ['itemType']),
		subType: _get(mainItem, ['itemSubType']),
		omniStatus: _get(mainItem, ['status']) || '',
		status: _get(mainItem, ['desktopStatus']) || '',
		subStatus: _get(mainItem, ['desktopSubStatus']) || '',
		returnBadge: _get(mainItem, ['returnBadge']),
		metadata: _get(mainItem, ['itemMetadata']),
		childItemId: _get(mainItem, ['associatedOrderItemIds']),
		abbData: _get(mainItem, ['assuredBuyBackData']),
		lastProgressText: getLastEventDateText(mainItem),
		itemId: _get(mainItem, ['orderItemId']),
		unitId: _get(mainItem, ['orderItemUnitIdString']),
		shipmentTracking: getShipmentTrackingInfo(mainItem),
		promiseFromDate: getFormattedDate(_get(mainItem, ['promiseFromDate'])),
		promisedDate: getFormattedDate(_get(mainItem, ['promisedDate'])),
		deliveryDate: getFormattedDate(_get(mainItem, ['actualDeliveredDate'])),
		offersCount: (_get(mainItem, ['itemOffers']) && mainItem.itemOffers.length) || 0,
		flags: {
			itemCancellable: _get(mainItem, ['itemCancellable']),
			itemReturnable: _get(mainItem, ['itemReturnable']),
			itemReviewable: _get(mainItem, ['itemReviewable']),
			itemSchedulable: _get(mainItem, ['itemSchedulable']),
			isPreOrder: _get(mainItem, ['preOrder'])
		},
		seller: _get(mainItem, ['sellerName']),
		sellerUrl: _get(mainItem, ['sellerUrl']),
		serviceItemInfo: _get(mainItem, ['serviceItemInfo']),
		vasItemDetails: _get(mainItem, ['vasItemDetails'])
	};
	if (_item.vasItemDetails && _get(_item, ['metadata', 'url'])) _item.metadata.url = '';
	return _item;
};

const getReturnRefunds = ({ returnTracking }) => {
	return returnTracking
		? returnTracking.reduce((details, ret) => {
			return ret.refundDetails ? (details || []).concat(ret.refundDetails) : details;
		}, null)
		: null;
};

const getRefundDetails = itemList => {
	if (!itemList || itemList.length === 0) return null;
	const items = [];
	itemList.map(item => {
		const refundInfo =
			getStatusList(item.nonReturnRefunds, 'refundStatus') || getReturnRefunds(item);
		if (refundInfo) {
			items.push({
				refundsList: refundInfo
			});
		}
	});
	return items.length > 0 ? items : null;
};

const getReturnDetails = (itemList, info) => {
	if (!itemList || itemList.length === 0) return null;
	const items = [];
	itemList.map(item => {
		const returnInfo = getStatusList(
			item.returnTracking,
			'returnStatus',
			item,
			itemList,
			info,
			item.returnBadge
		);
		if (returnInfo) {
			items.push({
				returnsList: returnInfo
			});
		}
	});
	return items.length > 0 ? items : null;
};

const getStatusList = (
	list,
	type,
	parentItem = null,
	itemsList = null,
	info = null,
	badge = null
) => {
	if (!list || list.length === 0) return null;

	const refinedList = list.filter(function (item) {
		return _get(item, [type]) !== 'Splitted';
	});

	if (type === 'refundStatus') {
		return refinedList;
	} else if (type === 'returnStatus') {
		if (!refinedList) return null;
		const returnItems = [];
		refinedList.map((listItem, i) => {
			const replacementOrExchangeItemId = listItem.replacementOrExchangeItemId;
			if (replacementOrExchangeItemId) {
				const returnSpecificData = badge
					? getItemInfo(parentItem, info)
					: getReturnSpecificData(itemsList, replacementOrExchangeItemId, info);
				returnItems.push({
					data: returnSpecificData,
					returnInfo: listItem
				});
			}
		});
		return returnItems.length > 0 ? returnItems : null;
	}
	return null;
};

const getReturnSpecificData = (itemList, itemId, info) => {
	if (!itemList) return null;

	const item = itemList.filter(function (item) {
		return item.orderItemId === itemId;
	});
	return item ? getItemInfo(item[0], info) : null;
};

const getFormattedDate = dateObj => {
	if (!dateObj) return null;
	return formatDate(dateObj, "ddd, MMM Do 'YY");
};

const getLastEventDateText = item => {
	if (!item) return null;
	const connector = ' on ';
	const steps = _get(item, ['itemProgressSteps']);
	const lastStep = steps ? steps[steps.length - 1].children : null;
	const lastEventDate = lastStep ? lastStep[lastStep.length - 1].eventDate : null;
	return lastEventDate ? connector + formatDate(lastEventDate, "ddd, MMM Do 'YY") : null;
};

const getShipmentTrackingInfo = item => {
	if (!item || _get(item, ['status']) !== 'Shipped') return null;
	const progressSteps = _get(item, ['itemProgressSteps']);
	const shippedStep =
		progressSteps &&
		progressSteps.filter(function (step) {
			return (
				step.groupName.toLowerCase() === 'shipping' &&
				step.status.toLowerCase() === 'current'
			);
		});
	const shippedChild =
		_get(shippedStep, [0, 'children']) &&
		shippedStep[0].children.filter(function (child) {
			return (
				child.eventLink &&
				child.eventLinkText &&
				child.eventName.toLowerCase() === 'itemshippedstep'
			);
		});
	if (shippedChild) {
		return {
			shipmentLink: _get(shippedChild, [0, 'eventLink']),
			shipmentText: _get(shippedChild, [0, 'eventLinkText'])
		};
	}
	return null;
};

const getGroceryBasketDetails = itemTypeGroups => {
	const groceryGroup = _get(itemTypeGroups, [GROUP_TYPES.GROCERY]);

	return Object.assign({}, getGroceryBasketFields(groceryGroup), {
		basketStatus: _get(groceryGroup, ['status'])
	});
};
