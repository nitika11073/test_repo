import safeTraverse from 'utils/safeTraverse';
import format from 'date-fns/format';
import isAfter from 'date-fns/is_after';
import {getFormattedSlot} from 'utils/scheduleDeliveryUtils';
import { stringTemplate } from 'components/StringWidget/StringWidget';
import {pick} from 'lodash';
import { GROUP_TYPES } from 'constants/OrderConstants';

const {FLIPKART, GROCERY} = GROUP_TYPES;

export const MAX_AUTO_LOAD_PAGES = 4;

export const orderDeadStates = [
	'cancelled',
	'cancel_requested',
	'cancellation requested'
];

export const orderTypes = {
	SUBSCRIPTION: 'subscription',
	PHYSICAL: 'physical',
	DIGITAL: 'digital',
	EGV: 'egv',
	DIGITAL_SERVICE: 'digital_service'
};

export const loadingStatus = {
	SHOW_MORE: 'SHOW_MORE',
	NO_MORE: 'NO_MORE',
	LOADING: 'LOADING'
};

export const orderState = {
	RETURN: 'RETURN',
	RETURN_REQUEST: 'RETURN_REQUEST',
	CANCEL: 'CANCEL',
	DONE: 'DONE',
	INACTIVE: 'INACTIVE',
	CURRENT: 'CURRENT',
	NA: 'NA'
};

export const actionTypes = {
	PRINT: 'print',
	CONTACTUS: 'contactus',
	REVIEW: 'review',
	CANCEL: 'cancel',
	RETURN: 'return',
	GIFTCARD: 'giftcard',
	ADDEGVTOWALLET: 'addegvtowallet',
	PAYNOW: 'payNow',
	INVOICE: 'invoice',
	SELLERREVIEW: 'sellerReview',
	SUBSCRIPTION: 'subscription'
};

export const getParentItem = itemList => {
	if (!itemList) return null;
	const parent = itemList.filter(function (item) {
		return (item.returnBadge === null);
	});
	return parent.length > 0 ? parent[0] : null;
};


export const segregateOrdersIntoGroups = (orderGranularDetails, groupedItems, groceryBasketDetails) => {
	const flipkartItemTypeList = getItemTypeList(orderGranularDetails, FLIPKART);
	const groceryItemTypeList = getItemTypeList(orderGranularDetails, GROCERY);
 
	let finalItems = [];	// final array containing all order items
	let groceryItems = [];	// used for further processing of grocery items

	groupedItems.forEach(groupedItem => {
		//	data structure is different for myOrders and orderDetailsdata.
		//	should take it up in future.
		const orderData = safeTraverse(groupedItem, ['data'], groupedItem);

		switch (orderData.groupType) {
			case FLIPKART: if (findItem(flipkartItemTypeList, orderData.unitId)) {
				finalItems.push(groupedItem);
			}
				break;
			case GROCERY: if (findItem(groceryItemTypeList, orderData.unitId)) {
				groceryItems.push(groupedItem);
			}
				break;
			default: break;
		}
	});

	//	compute this for grocery basket.
	const cancellableItems = groceryItems.length > 0 && getCancellableItems(groceryItems);

	//	push items into basket and basket as main order item to list.
	groceryItems.length > 0 && finalItems.push(Object.assign({}, groceryBasketDetails, {
		orderItems: groceryItems,
		unitIdsString: cancellableItems.map(item => {
			const orderData = safeTraverse(item, ['data'], item);
			return orderData.unitId;
		}).join(',')
	}));

	return finalItems;
};


export const getGroceryBasketFields = groceryData => {
	return {
		groupType: GROCERY,
		returnPolicy: safeTraverse(groceryData, ['returnPolicy']),
		basketAmount: safeTraverse(groceryData, ['groupAmount']),
		basketSellerName: safeTraverse(groceryData, ['groupSellerName']),
		basketSellerLink: safeTraverse(groceryData, ['groupSellerLink']),
		basketOffersCount: safeTraverse(groceryData, ['groupOffersCount']),
		basketLevelOffers: safeTraverse(groceryData, ['groupLevelOffers']),
		basketStatusCount: safeTraverse(groceryData, ['statusCounts']),
		basketDeliveryStatus: safeTraverse(groceryData, ['desktopStatus']),
		basketSubStatus: safeTraverse(groceryData, ['desktopSubStatus']),
		basketCancellable: safeTraverse(groceryData, ['basketCancellable'])
	};
};

